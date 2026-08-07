import pygame
import cv2
import mediapipe as mp
import numpy as np
import math
import random

# ==========================================
# ⚙️ HIGH-PERFORMANCE SETTINGS
# ==========================================
WIDTH, HEIGHT = 1280, 720
PARTICLE_COUNT = 4500  # High count, handled by Numpy
GLOW_SIZE = 8          # Size of the particle texture
FRICTION = 0.94        # Physics damping
SPEED = 0.08           # Morphing speed

# Colors (R, G, B)
COLOR_PALETTE = [
    (0, 255, 255),  # Cyan
    (255, 0, 255),  # Magenta
    (50, 100, 255), # Deep Blue
    (255, 255, 255) # White
]

# ==========================================
# 🧠 AI ENGINE (Optimized)
# ==========================================
class HandBrain:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.cap = cv2.VideoCapture(0)
        
    def scan(self):
        ret, frame = self.cap.read()
        if not ret: return 0, (0,0)
        
        # Mirror & Resize for speed
        frame = cv2.flip(frame, 1)
        frame_small = cv2.resize(frame, (640, 480)) # Analyze smaller image for FPS
        rgb = cv2.cvtColor(frame_small, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb)
        
        count = 0
        center = (0,0)
        
        if results.multi_hand_landmarks:
            count = len(results.multi_hand_landmarks)
            # Get index finger tip of first hand for interaction
            lm = results.multi_hand_landmarks[0].landmark[8]
            center = (lm.x, lm.y)
            
        return count, center
        
    def release(self):
        self.cap.release()

# ==========================================
# 💥 VECTORIZED PARTICLE SYSTEM
# ==========================================
class ParticleSystem:
    def __init__(self):
        # 1. Position Matrix (N, 3) -> X, Y, Z
        self.pos = np.random.rand(PARTICLE_COUNT, 3) * 800 - 400
        # 2. Velocity Matrix (N, 3)
        self.vel = np.zeros((PARTICLE_COUNT, 3))
        # 3. Target Matrix (N, 3)
        self.target = np.copy(self.pos)
        
        # Pre-render a glowing circle texture for speed
        self.texture = pygame.Surface((GLOW_SIZE*2, GLOW_SIZE*2), pygame.SRCALPHA)
        # Draw soft gradient circle
        for r in range(GLOW_SIZE, 0, -1):
            alpha = int((r / GLOW_SIZE) * 255) # Fade out
            color = (100, 200, 255, alpha // 4) # Low alpha for additive blend
            pygame.draw.circle(self.texture, color, (GLOW_SIZE, GLOW_SIZE), r)
            
    def update(self):
        # --- NUMPY PHYSICS (The Fast Part) ---
        # Calculate distance to target
        diff = self.target - self.pos
        
        # Apply force (Spring physics)
        self.vel += diff * SPEED
        
        # Apply Noise (Jitter)
        noise = np.random.rand(PARTICLE_COUNT, 3) * 2 - 1
        self.vel += noise * 0.5
        
        # Apply Friction
        self.vel *= FRICTION
        
        # Update Position
        self.pos += self.vel
        
    def draw(self, surface):
        # --- 3D PROJECTION ---
        # Simple perspective projection
        fov = 400
        # Z-depth sorting (Painter's Algorithm) not strictly needed for additive, 
        # but scaling adds depth
        
        # Avoid division by zero with small offset
        z_dist = self.pos[:, 2] + 600
        scale = fov / np.maximum(z_dist, 1) # Vectorized division
        
        # Project to 2D
        x2d = self.pos[:, 0] * scale + WIDTH // 2
        y2d = self.pos[:, 1] * scale + HEIGHT // 2
        
        # Convert to integers for Pygame
        # Filter points that are off-screen for speed
        valid_indices = (x2d > 0) & (x2d < WIDTH) & (y2d > 0) & (y2d < HEIGHT) & (z_dist > 10)
        
        final_x = x2d[valid_indices].astype(int)
        final_y = y2d[valid_indices].astype(int)
        
        # Batch drawing isn't natively supported in Pygame 2D like OpenGL,
        # but blitting pre-rendered surfaces is fast.
        for i in range(len(final_x)):
            # Using BLEND_ADD gives that neon laser look
            surface.blit(self.texture, (final_x[i], final_y[i]), special_flags=pygame.BLEND_ADD)

# ==========================================
# 📐 SHAPE GENERATORS
# ==========================================
def make_galaxy():
    # Spiral Math
    indices = np.arange(PARTICLE_COUNT)
    angle = indices * 0.1
    radius = indices * 0.15
    
    x = np.cos(angle) * radius * 4
    y = (np.random.rand(PARTICLE_COUNT) - 0.5) * 50
    z = np.sin(angle) * radius * 4
    return np.column_stack((x, y, z))

def make_text(text_str):
    # Use Pygame font engine to scan pixels
    font = pygame.font.SysFont("Arial", 120, bold=True)
    surf = font.render(text_str, True, (255, 255, 255))
    w, h = surf.get_size()
    pixels = pygame.surfarray.array2d(surf)
    
    # Extract coordinates where pixels exist
    points = np.argwhere(pixels > 0) # returns (x, y)
    
    if len(points) == 0: return np.zeros((PARTICLE_COUNT, 3))

    # Center the text
    points = points - [w//2, h//2]
    
    # Scale up
    points = points * 4 
    
    # We need exactly PARTICLE_COUNT points.
    # If text has fewer points, repeat them. If more, shuffle and slice.
    if len(points) < PARTICLE_COUNT:
        repeat_factor = (PARTICLE_COUNT // len(points)) + 1
        points = np.tile(points, (repeat_factor, 1))
    
    np.random.shuffle(points)
    points = points[:PARTICLE_COUNT]
    
    # Add Z depth (0)
    z = np.zeros((PARTICLE_COUNT, 1))
    
    # Flip Y because Pygame coords are top-down
    points[:, 1] *= -1
    
    return np.column_stack((points, z))

def make_cake():
    # Cylindrical Cake
    n = PARTICLE_COUNT
    
    # Base (70% of particles)
    base_n = int(n * 0.7)
    candle_n = n - base_n
    
    # Base
    r = np.sqrt(np.random.rand(base_n)) * 150
    theta = np.random.rand(base_n) * 2 * np.pi
    x1 = r * np.cos(theta)
    z1 = r * np.sin(theta)
    y1 = np.random.rand(base_n) * 100 - 50 # Height
    
    # Candle
    x2 = np.zeros(candle_n)
    z2 = np.zeros(candle_n)
    y2 = np.random.rand(candle_n) * 80 - 150 # On top
    
    base = np.column_stack((x1, y1, z1))
    candle = np.column_stack((x2, y2, z2))
    
    return np.vstack((base, candle))


# ==========================================
# 🎬 MAIN RUNNER
# ==========================================
def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("PROJECT PSHE: HIGH PERFORMANCE")
    clock = pygame.time.Clock()
    
    # Init Systems
    ai = HandBrain()
    p_sys = ParticleSystem()
    
    # Shapes
    targets = {
        'GALAXY': make_galaxy(),
        'CAKE': make_cake(),
        'TEXT': make_text("HAPPY B-DAY"),
        'NAME': make_text("PSHE")
    }
    
    current_shape = 'GALAXY'
    p_sys.target = targets['GALAXY']
    
    running = True
    trigger_timer = 0
    celebration_started = False
    
    # UI Font
    font_ui = pygame.font.SysFont("Consolas", 16)
    
    while running:
        dt = clock.tick(60) # Lock to 60 FPS
        screen.fill((5, 5, 10)) # Dark background (Not black, looks better with add blend)

        # 1. Event Handling
        for event in pygame.event.get():
            if event.type == pygame.QUIT: running = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE: # Manual Debug Trigger
                    celebration_started = True
                    current_shape = 'CAKE'
                    p_sys.target = targets['CAKE']
                    trigger_timer = pygame.time.get_ticks()

        # 2. AI Logic (Run every frame or every N frames)
        hands_detected, hand_center = ai.scan()
        
        if not celebration_started:
            if hands_detected == 2:
                # Trigger Sequence!
                celebration_started = True
                current_shape = 'CAKE'
                p_sys.target = targets['CAKE']
                trigger_timer = pygame.time.get_ticks()
            
            # Interactive Galaxy (Move with 1 hand)
            if hands_detected == 1:
                # Map hand (0-1) to screen space (-400 to 400)
                tx = (hand_center[0] - 0.5) * -1000 # Invert X
                ty = (hand_center[1] - 0.5) * 1000
                # Offset the galaxy target
                p_sys.target = targets['GALAXY'] + [tx, ty, 0]
        
        # 3. Sequencer logic
        if celebration_started:
            now = pygame.time.get_ticks()
            elapsed = now - trigger_timer
            
            if 1000 < elapsed < 5000:
                current_shape = "CAKE" # Just ensuring
            elif 5000 < elapsed < 9000:
                if current_shape != "TEXT":
                    p_sys.target = targets['TEXT']
                    # Explosion Effect (Randomize velocity)
                    p_sys.vel += (np.random.rand(PARTICLE_COUNT, 3) - 0.5) * 20
                    current_shape = "TEXT"
            elif elapsed > 9000:
                if current_shape != "NAME":
                    p_sys.target = targets['NAME']
                    p_sys.vel += (np.random.rand(PARTICLE_COUNT, 3) - 0.5) * 30
                    current_shape = "NAME"

        # 4. Physics & Render
        p_sys.update()
        
        # Rotate entire system slowly
        theta = 0.005
        rotation_matrix = np.array([
            [np.cos(theta), 0, np.sin(theta)],
            [0, 1, 0],
            [-np.sin(theta), 0, np.cos(theta)]
        ])
        p_sys.pos = p_sys.pos.dot(rotation_matrix)
        p_sys.target = p_sys.target.dot(rotation_matrix)
        
        p_sys.draw(screen)

        # 5. UI Overlay
        if not celebration_started:
            fps = int(clock.get_fps())
            info = font_ui.render(f"FPS: {fps} | HANDS: {hands_detected}", True, (0, 255, 0))
            guide = font_ui.render("RAISE 2 HANDS TO START CELEBRATION", True, (100, 200, 255))
            screen.blit(info, (10, 10))
            screen.blit(guide, (WIDTH//2 - 150, HEIGHT - 50))
        
        pygame.display.flip()

    ai.release()
    pygame.quit()

if __name__ == "__main__":
    main()
