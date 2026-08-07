import sun.misc.Unsafe;
import java.lang.reflect.Field;

public class UnsafeExample {
    private static Unsafe getUnsafe() throws Exception {
        Field f = Unsafe.class.getDeclaredField("theUnsafe");
        f.setAccessible(true);
        return (Unsafe) f.get(null);
    }

    public static void main(String[] args) throws Exception {
        Unsafe unsafe = getUnsafe();
        long address = unsafe.allocateMemory(8); // allocate 8 bytes
        unsafe.putLong(address, 123456789L); // write a long
        long value = unsafe.getLong(address); // read it
        System.out.println("Value: " + value);
        unsafe.freeMemory(address); // free
    }
}
