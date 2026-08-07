import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_styled_poster():
    prs = pptx.Presentation()
    
    # Set to Portrait A0 Size (33.1 inches x 46.8 inches)
    prs.slide_width = Inches(33.1)
    prs.slide_height = Inches(46.8)
    
    # Use blank layout
    blank_slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank_slide_layout)

    # --- Colors extracted from the reference image ---
    bg_color = RGBColor(30, 30, 30)         # Dark Charcoal/Black background
    accent_color = RGBColor(90, 80, 50)     # Olive/Brown for headers
    white = RGBColor(255, 255, 255)
    black = RGBColor(0, 0, 0)
    
    # 1. Add Dark Background
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = bg_color
    bg.line.color.rgb = bg_color

    # 2. Main Top Header
    header = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1), Inches(1), Inches(31.1), Inches(4))
    header.fill.solid()
    header.fill.fore_color.rgb = accent_color
    header.line.color.rgb = white
    header.line.width = Pt(2)
    
    # Logo Placeholder in Header (Left Side)
    logo = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(1.5), Inches(1.5), Inches(3), Inches(3))
    logo.fill.solid()
    logo.fill.fore_color.rgb = bg_color
    logo.line.color.rgb = white
    logo.text_frame.text = "LOGO"
    logo.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER
    logo.text_frame.paragraphs[0].font.color.rgb = white

    # Header Title Text
    title_box = slide.shapes.add_textbox(Inches(5), Inches(1.5), Inches(26), Inches(3))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = "MAIN POSTER TITLE GOES HERE\nSubtitle / Author Names Here"
    p.font.size = Pt(60)
    p.font.bold = True
    p.font.color.rgb = white
    p.alignment = PP_ALIGN.CENTER

    # --- Helper Functions for Layout ---
    
    def add_text_block(x, y, w, h, title):
        """Creates a text block with a colored title bar and white body."""
        # Title Bar
        t_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(1.5))
        t_bar.fill.solid()
        t_bar.fill.fore_color.rgb = accent_color
        t_bar.line.color.rgb = white
        t_bar.line.width = Pt(2)
        t_p = t_bar.text_frame.paragraphs[0]
        t_p.text = title
        t_p.font.size = Pt(36)
        t_p.font.bold = True
        t_p.font.color.rgb = white
        t_p.alignment = PP_ALIGN.CENTER

        # White Content Box below Title Bar
        c_box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y+1.5), Inches(w), Inches(h-1.5))
        c_box.fill.solid()
        c_box.fill.fore_color.rgb = white
        c_box.line.color.rgb = white
        c_box.line.width = Pt(2)
        c_p = c_box.text_frame.paragraphs[0]
        c_p.text = "Enter your text here...\n\n- Point 1\n- Point 2\n- Point 3"
        c_p.font.size = Pt(28)
        c_p.font.color.rgb = black

    def add_pic_placeholder(x, y, w, h, label):
        """Creates a grey box to represent where an image goes."""
        pic = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
        pic.fill.solid()
        pic.fill.fore_color.rgb = RGBColor(200, 200, 200) # Light Grey
        pic.line.color.rgb = white
        pic.line.width = Pt(3)
        tf = pic.text_frame
        p = tf.paragraphs[0]
        p.text = f"[ {label} ]\nClick to replace or paste image over this box"
        p.font.size = Pt(32)
        p.font.bold = True
        p.font.color.rgb = bg_color
        p.alignment = PP_ALIGN.CENTER

    # --- Grid Layout (3 Columns, 9.7 inches wide each) ---
    col1_x = 1.0
    col2_x = 11.7
    col3_x = 22.4
    col_w = 9.7

    # COLUMN 1
    add_pic_placeholder(col1_x, 6.0, col_w, 13.0, "PICTURE 1")
    add_text_block(col1_x, 20.0, col_w, 25.8, "TEXT BLOCK 1")

    # COLUMN 2
    add_text_block(col2_x, 6.0, col_w, 13.0, "TEXT BLOCK 2")
    add_pic_placeholder(col2_x, 20.0, col_w, 12.0, "PICTURE 2")
    add_text_block(col2_x, 33.0, col_w, 12.8, "TEXT BLOCK 3")

    # COLUMN 3
    add_text_block(col3_x, 6.0, col_w, 20.0, "TEXT BLOCK 4")
    add_pic_placeholder(col3_x, 27.0, col_w, 18.8, "PICTURE 3")

    # Save locally
    filename = 'Dark_Theme_Poster_3Pic_4Text.pptx'
    prs.save(filename)
    print(f"Success! Poster saved as '{filename}' in the current directory.")
    print("Open the .pptx file in PowerPoint to edit text and replace image placeholders.")
    return filename

if __name__ == "__main__":
    create_styled_poster()
