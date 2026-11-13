import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.Random;

/**
 * VELARA launcher icon generator — programmatic, no AI, no deps.
 * Design: dark charcoal rounded square, asphalt grain, faint skyline strip,
 * bold white "P" (PRIYANSH), warm orange accent bar. Overcast-mood palette.
 *
 * Usage: java tools/IconGen.java <android-res-dir>
 */
public class IconGen {

  static void draw(Graphics2D g, int S, boolean round) {
    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

    // ---- background: charcoal rounded square / circle
    g.setColor(new Color(0x17191e));
    if (round) {
      g.fillOval(0, 0, S, S);
    } else {
      int r = (int) (S * 0.22);
      g.fillRoundRect(0, 0, S - 1, S - 1, r, r);
    }

    // ---- asphalt grain (deterministic)
    Random rnd = new Random(42);
    g.setColor(new Color(0x1e2127));
    int specks = S * 3;
    int maxW = Math.max(1, S / 220);
    for (int i = 0; i < specks; i++) {
      int x = rnd.nextInt(S), y = rnd.nextInt(S);
      int w = 1 + rnd.nextInt(maxW);
      g.fillRect(x, y, w, w);
    }

    // ---- faint skyline strip (bottom)
    g.setColor(new Color(0x242832));
    int base = (int) (S * 0.80);
    int bw = S / 7;
    for (int i = 0; i < 7; i++) {
      int bh = (int) (S * (0.05 + 0.055 * ((i * 37) % 5) / 5.0));
      g.fillRect(i * bw + bw / 6, base - bh, bw - bw / 3, S - base + bh);
    }

    // ---- orange accent bar (under the P)
    g.setColor(new Color(0xe07b39));
    g.fillRect((int) (S * 0.28), (int) (S * 0.685), (int) (S * 0.44), (int) (Math.max(2, S * 0.032)));

    // ---- bold P
    g.setColor(new Color(0xf4f6f9));
    Font f = new Font(Font.SANS_SERIF, Font.BOLD, (int) (S * 0.50));
    g.setFont(f);
    FontMetrics fm = g.getFontMetrics();
    String t = "P";
    int x = (S - fm.stringWidth(t)) / 2;
    int y = (int) (S * 0.44 - fm.getHeight() / 2.0) + fm.getAscent();
    g.drawString(t, x, y);
  }

  static BufferedImage render(int S, boolean round) {
    BufferedImage img = new BufferedImage(S, S, BufferedImage.TYPE_INT_ARGB);
    Graphics2D g = img.createGraphics();
    draw(g, S, round);
    g.dispose();
    return img;
  }

  public static void main(String[] args) throws Exception {
    File res = new File(args[0]);
    int[][] D = {
        { 48, "mipmap-mdpi" }, { 72, "mipmap-hdpi" }, { 96, "mipmap-xhdpi" },
        { 144, "mipmap-xxhdpi" }, { 192, "mipmap-xxxhdpi" },
    };
    for (int[] d : D) {
      File dir = new File(res, d[1]);
      dir.mkdirs();
      ImageIO.write(render(d[0], false), "png", new File(dir, "ic_launcher.png"));
      ImageIO.write(render(d[0], true), "png", new File(dir, "ic_launcher_round.png"));
    }
    System.out.println("icons written: " + res);
  }
}
