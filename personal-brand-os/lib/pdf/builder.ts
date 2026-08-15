import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { LOGO_LIGHT_BASE64 } from "@/lib/pdf/logo-data";

/** Print palette — the brand navy/teal on white, not the app's dark theme. */
export const NAVY = rgb(0.06, 0.11, 0.17);
export const TEAL = rgb(0.06, 0.45, 0.52);
export const INK = rgb(0.09, 0.1, 0.12);
export const SOFT = rgb(0.32, 0.35, 0.41);
export const FAINT = rgb(0.55, 0.58, 0.63);
export const LINE = rgb(0.84, 0.86, 0.89);

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const FOOTER_SPACE = 46;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Standard-font text is WinAnsi-encoded; anything outside gets replaced so
// drawText never throws on user-entered characters (emoji, etc.).
const WINANSI_OK =
  /[\n\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/;
function sanitize(text: string): string {
  return [...text.replace(/\r/g, "")].map((ch) => (WINANSI_OK.test(ch) ? ch : "?")).join("");
}

/** Cursor-based A4 layout on pdf-lib: headings, labelled fields, bullets,
 * automatic page breaks, logo header on page one, numbered footers on all. */
export class PdfBuilder {
  private doc!: PDFDocument;
  private font!: PDFFont;
  private bold!: PDFFont;
  private logo!: PDFImage;
  private page!: PDFPage;
  /** Distance from the top of the page to the next line's baseline area. */
  private cursor = MARGIN;

  static async create(): Promise<PdfBuilder> {
    const builder = new PdfBuilder();
    builder.doc = await PDFDocument.create();
    builder.font = await builder.doc.embedFont(StandardFonts.Helvetica);
    builder.bold = await builder.doc.embedFont(StandardFonts.HelveticaBold);
    builder.logo = await builder.doc.embedPng(Buffer.from(LOGO_LIGHT_BASE64, "base64"));
    builder.newPage();
    return builder;
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.cursor = MARGIN;
  }

  private ensure(height: number) {
    if (this.cursor + height > PAGE_HEIGHT - MARGIN - FOOTER_SPACE) this.newPage();
  }

  private wrap(text: string, font: PDFFont, size: number): string[] {
    const lines: string[] = [];
    for (const paragraph of sanitize(text).split("\n")) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push("");
        continue;
      }
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= CONTENT_WIDTH && candidate.length < 1000) {
          current = candidate;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      }
      if (current) lines.push(current);
    }
    return lines;
  }

  private drawLines(lines: string[], font: PDFFont, size: number, color: RGB, lineHeight: number, indent = 0) {
    for (const line of lines) {
      this.ensure(lineHeight);
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: PAGE_HEIGHT - this.cursor - size,
        size,
        font,
        color,
      });
      this.cursor += lineHeight;
    }
  }

  /** Page-one masthead: logo, document title, client, meta line. */
  header(title: string, subtitle: string, metaLine: string) {
    const logoHeight = 34;
    const logoWidth = (this.logo.width / this.logo.height) * logoHeight;
    this.page.drawImage(this.logo, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });
    this.cursor = MARGIN + logoHeight + 26;

    this.drawLines(this.wrap(title, this.bold, 22), this.bold, 22, NAVY, 27);
    this.drawLines(this.wrap(subtitle, this.font, 13), this.font, 13, TEAL, 18);
    this.cursor += 2;
    this.drawLines(this.wrap(metaLine, this.font, 9), this.font, 9, FAINT, 13);
    this.rule();
  }

  rule() {
    this.ensure(16);
    this.cursor += 6;
    this.page.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - this.cursor },
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - this.cursor },
      thickness: 0.75,
      color: LINE,
    });
    this.cursor += 10;
  }

  heading(text: string) {
    this.ensure(40);
    this.cursor += 10;
    this.drawLines(this.wrap(text.toUpperCase(), this.bold, 10.5), this.bold, 10.5, TEAL, 15);
    this.cursor += 1;
  }

  field(label: string, value: string) {
    if (!value.trim()) return;
    this.ensure(26);
    this.drawLines(this.wrap(label.toUpperCase(), this.bold, 7.5), this.bold, 7.5, FAINT, 11);
    this.drawLines(this.wrap(value, this.font, 10), this.font, 10, INK, 14);
    this.cursor += 6;
  }

  para(text: string) {
    if (!text.trim()) return;
    this.drawLines(this.wrap(text, this.font, 10), this.font, 10, INK, 14);
    this.cursor += 4;
  }

  subitem(title: string, body: string) {
    this.ensure(28);
    this.drawLines(this.wrap(title, this.bold, 10.5), this.bold, 10.5, NAVY, 14);
    if (body.trim()) this.drawLines(this.wrap(body, this.font, 10), this.font, 10, SOFT, 14);
    this.cursor += 6;
  }

  bullet(text: string) {
    const lines = this.wrap(text, this.font, 10);
    this.ensure(14);
    this.page.drawText("•", { x: MARGIN, y: PAGE_HEIGHT - this.cursor - 10, size: 10, font: this.font, color: TEAL });
    this.drawLines(lines, this.font, 10, INK, 14, 12);
    this.cursor += 2;
  }

  note(text: string) {
    this.drawLines(this.wrap(text, this.font, 8.5), this.font, 8.5, FAINT, 12);
    this.cursor += 2;
  }

  spacer(height = 8) {
    this.cursor += height;
  }

  /** Statistic row: big number + caption, laid out in columns of three. */
  stats(items: { value: string; caption: string }[]) {
    const perRow = 3;
    const colWidth = CONTENT_WIDTH / perRow;
    for (let start = 0; start < items.length; start += perRow) {
      const row = items.slice(start, start + perRow);
      this.ensure(44);
      row.forEach((item, i) => {
        const x = MARGIN + i * colWidth;
        this.page.drawText(sanitize(item.value), {
          x,
          y: PAGE_HEIGHT - this.cursor - 16,
          size: 16,
          font: this.bold,
          color: NAVY,
        });
        this.page.drawText(sanitize(item.caption).slice(0, 60), {
          x,
          y: PAGE_HEIGHT - this.cursor - 30,
          size: 8,
          font: this.font,
          color: FAINT,
        });
      });
      this.cursor += 44;
    }
    this.cursor += 4;
  }

  /** Footer every page, then serialize. */
  async finish(footerText: string): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawLine({
        start: { x: MARGIN, y: MARGIN - 14 },
        end: { x: PAGE_WIDTH - MARGIN, y: MARGIN - 14 },
        thickness: 0.5,
        color: LINE,
      });
      page.drawText(sanitize(footerText), {
        x: MARGIN,
        y: MARGIN - 26,
        size: 7.5,
        font: this.font,
        color: FAINT,
      });
      const pageLabel = `Page ${index + 1} of ${pages.length}`;
      page.drawText(pageLabel, {
        x: PAGE_WIDTH - MARGIN - this.font.widthOfTextAtSize(pageLabel, 7.5),
        y: MARGIN - 26,
        size: 7.5,
        font: this.font,
        color: FAINT,
      });
    });
    return this.doc.save();
  }
}
