#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Updated Professional Arabic/English receipt printing for 80mm paper (576px)
with direct printing and improved styling.

- Supports both Arabic (arabic_reshaper + python-bidi) and English.
- Professional header: "📚 Redux Educational System" + "Modern Learning School" + Date and Time.
- Embeds a logo from a URL (optional).
- Direct printing via ESC/POS to /dev/usb/lp1 (Raster GS v 0).
- Fallback attempts: python-escpos if available, then CUPS (lp).
- Saves a PNG preview on failure.
- Implemented a new, more robust font loading to prevent 'square' character issues.
- Added a more reliable paper feed command to prevent cutting text prematurely.

Requirements (Python):
    pip install pillow flask arabic-reshaper python-bidi requests python-escpos

Notes:
- If python-escpos is not installed, it will use raw printing via /dev/usb/lp1 with ESC/POS Raster commands.
- Ensure permissions for /dev/usb/lp1 (e.g., sudo chmod 666 /dev/usb/lp1)
- The transliteration feature is removed to simplify the code, as the printer now handles both languages.
"""

import os
import io
import datetime
import tempfile
import subprocess
from typing import Optional, Dict

import requests
import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFont
from flask import Flask, request, jsonify

# Optional: ESC/POS library
try:
    from escpos.printer import Usb, File as EscposFile
except Exception:
    Usb = None
    EscposFile = None

app = Flask(__name__)

# General settings
PAPER_WIDTH = 576  # pixels for 80mm paper
MARGIN_X = 12
BACKGROUND = 255  # White
FOREGROUND = 0    # Black

# Potential Arabic and a good fallback font list
# These are common system font paths.
# If you face issues, you might need to install them or update the paths.
# تم تحديث قائمة الخطوط لتكون أكثر شمولاً وموثوقية
ARABIC_FONTS = [
    "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
    "/usr/share/fonts/truetype/amiri/Amiri-Regular.ttf",
    "/usr/share/fonts/truetype/lateef/Lateef.ttf",
    "NotoSans-Regular.ttf", # Generic Noto fallback
    "Amiri-Regular.ttf",
]
FALLBACK_FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "arialuni.ttf",
    "Arial Unicode MS.ttf",
    "Arial Unicode.ttf",
    "arial.ttf",
    "Times New Roman.ttf",
    "LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]

def load_font(size: int) -> ImageFont.FreeTypeFont:
    """
    Load a suitable font, prioritizing a robust list of system fonts
    that support both Arabic and Latin characters.
    """
    font_paths_to_try = ARABIC_FONTS + FALLBACK_FONTS
    for path in font_paths_to_try:
        try:
            return ImageFont.truetype(path, size)
        except IOError:
            # Continue to the next font in the list if the current one is not found
            continue
        except Exception:
            # Catch other potential errors
            continue
    # Last resort fallback if no specific font files are found
    return ImageFont.load_default()


def process_arabic_text(text: str) -> str:
    """
    Reshape and reorder Arabic text for correct visual display (RTL support).
    """
    if text is None:
        return ""
    # Ensure text is a string before reshaping
    return get_display(arabic_reshaper.reshape(str(text)))


def fetch_logo(logo_url: Optional[str], max_width: int) -> Optional[Image.Image]:
    """Download logo from URL and resize it to fit the width."""
    if not logo_url:
        return None
    try:
        resp = requests.get(logo_url, timeout=8)
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
        w, h = img.size
        if w > max_width:
            ratio = max_width / float(w)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
        # Convert white background to pure white
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        return bg.convert("L")
    except Exception:
        return None


def decorative_separator(draw: ImageDraw.ImageDraw, y: int, width: int, font: ImageFont.ImageFont) -> int:
    """Draw a decorative text separator in the middle."""
    deco = process_arabic_text("—" * 10 + " ✦ " + "—" * 10)
    w = draw.textlength(deco, font=font, direction="rtl")
    x = (width - w) // 2
    draw.text((x, y), deco, font=font, fill=FOREGROUND, direction="rtl")
    return y + font.size + 10


def build_lines(receipt_data: dict) -> list[str]:
    """Prepare the main text lines after processing Arabic text."""
    system_title = process_arabic_text("📚 Redux Educational System")
    school_name = process_arabic_text(receipt_data.get("school_name", "Modern Learning School"))
    now_date = receipt_data.get("header_date") or datetime.datetime.now().strftime("%Y-%m-%d")
    now_time = receipt_data.get("header_time") or datetime.datetime.now().strftime("%H:%M")
    date_line = process_arabic_text(f"Date: {now_date}")
    time_line = process_arabic_text(f"Time: {now_time}")

    is_reg = receipt_data["type"] == "registration"

    header = [system_title, school_name, date_line + "   " + time_line, "----"]

    if is_reg:
        body = [
            process_arabic_text(f"Receipt No: {receipt_data.get('receipt_number', '')}"),
            process_arabic_text(f"Registration Date: {receipt_data.get('registration_date', '')}"),
            "----",
            process_arabic_text(f"Student Name: {receipt_data.get('student_name', '')}"),
            process_arabic_text(f"Student ID: {receipt_data.get('student_id', 'Not Registered')}"),
            process_arabic_text(f"Academic Year: {receipt_data.get('academic_year', 'Not Specified')}"),
            process_arabic_text(f"Parent Name: {receipt_data.get('parent_name', 'Not Specified')}"),
            process_arabic_text(f"Parent Phone: {receipt_data.get('parent_phone', 'Not Specified')}"),
            "----",
            process_arabic_text(f"Receiver: {receipt_data.get('receiver', 'Unknown')}"),
            "----",
            process_arabic_text("Thank you for your trust"),
        ]
    else:
        body = [
            process_arabic_text(f"Receipt No: {receipt_data.get('receipt_number', '')}"),
            process_arabic_text(f"Date: {receipt_data.get('payment_date', 'Not Specified')}"),
            process_arabic_text(f"Time: {receipt_data.get('payment_time', datetime.datetime.now().strftime('%H:%M'))}"),
            "----",
            process_arabic_text(f"Student Name: {receipt_data.get('student_name', 'Unknown')}"),
            process_arabic_text(f"Student ID: {receipt_data.get('student_id', 'Unknown')}"),
            process_arabic_text(f"Class: {receipt_data.get('class_name', 'Unknown')}"),
            process_arabic_text(f"Month: {receipt_data.get('month', 'Not Specified')}"),
            "----",
            process_arabic_text(f"Amount: {receipt_data.get('amount', 0)} D.A."),
            process_arabic_text(f"Payment Method: {receipt_data.get('payment_method', 'Unknown')}"),
            process_arabic_text(f"Receiver: {receipt_data.get('receiver', 'Unknown')}"),
            "----",
            process_arabic_text("Parent's Signature"),
            "----",
            process_arabic_text("Thank you for your trust"),
        ]
    return header + body


def layout_receipt(lines: list[str], logo_url: Optional[str] = None) -> Image.Image:
    """Draw the receipt with a professional design at 576px width."""
    width = PAPER_WIDTH
    canvas = Image.new("L", (width, 5000), BACKGROUND)  # Long canvas
    draw = ImageDraw.Draw(canvas)

    # Fonts - Increased sizes for 80mm paper, optimized for clarity
    font_logo = load_font(40)
    font_title = load_font(50)
    font_school = load_font(44)
    font_meta = load_font(34)
    font_body = load_font(36)
    font_small = load_font(30)

    y = 20

    # Top logo (optional)
    logo = fetch_logo(logo_url, max_width=width - 2 * MARGIN_X)
    if logo is not None:
        lw, lh = logo.size
        x = (width - lw) // 2
        canvas.paste(logo, (x, y))
        y += lh + 16

    # System title
    sys_title = process_arabic_text("📚 Redux Educational System")
    w = draw.textlength(sys_title, font=font_title, direction="rtl")
    x = (width - w) // 2
    draw.text((x, y), sys_title, font=font_title, fill=FOREGROUND, direction="rtl")
    y += font_title.size + 4

    # School name
    school = process_arabic_text("Modern Learning School")
    w = draw.textlength(school, font=font_school, direction="rtl")
    x = (width - w) // 2
    draw.text((x, y), school, font=font_school, fill=FOREGROUND, direction="rtl")
    y += font_school.size + 4

    # Decorative separator
    y = decorative_separator(draw, y, width, font_small)

    # Simple separator
    draw.line((MARGIN_X, y, width - MARGIN_X, y), fill=FOREGROUND, width=1)
    y += 16

    # Draw remaining lines
    for i, line in enumerate(lines):
        if line == "----":
            y = decorative_separator(draw, y, width, font_small)
            continue

        # Choose appropriate size based on line position
        if i == 0:
            f = font_title
        elif i == 1:
            f = font_school
        elif i == 2:
            f = font_meta
        else:
            # Adjust size if the line is long
            f = font_body if len(line) <= 40 else font_small

        w = draw.textlength(line, font=f, direction="rtl")
        x = (width - w) // 2
        draw.text((x, y), line, font=f, fill=FOREGROUND, direction="rtl")
        y += f.size + 10

    # Crop the canvas to fit the content
    result = canvas.crop((0, 0, width, min(y + 20, canvas.height)))
    # Convert to 1-bit for thermal printing
    return result.convert("1")


def escpos_raster_bytes(pil_img: Image.Image) -> bytes:
    """
    Convert a 1-bit image to an ESC/POS Raster command (GS v 0).
    1 = black dot, 0 = white.
    """
    img = pil_img.convert("1")
    width, height = img.size
    width_bytes = (width + 7) // 8
    # Collect bits row by row (horizontally)
    pixels = img.load()
    data = bytearray()
    for y in range(height):
        byte = 0
        bit_count = 0
        for x in range(width):
            # In PIL "1" mode, value 0 = black, 255 = white
            # We need 1 for black in ESC/POS, so we reverse the logic
            is_black = (pixels[x, y] == 0)
            byte = (byte << 1) | (1 if is_black else 0)
            bit_count += 1
            if bit_count == 8:
                data.append(byte)
                byte = 0
                bit_count = 0
        if bit_count != 0:
            # Pad the last byte
            byte = byte << (8 - bit_count)
            data.append(byte)

    # GS v 0 header
    # GS v 0 m xL xH yL yH
    m = 0  # Normal
    xL = width_bytes & 0xFF
    xH = (width_bytes >> 8) & 0xFF
    yL = height & 0xFF
    yH = (height >> 8) & 0xFF
    header = bytes([0x1D, 0x76, 0x30, m, xL, xH, yL, yH])
    # Add initialize
    init = bytes([0x1B, 0x40])  # ESC @
    # Cut paper (some printers may not support cut command)
    # GS V m
    cut = bytes([0x1D, 0x56, 0x00])  # GS V 0 (partial cut)
    # Feed paper by 8 lines to prevent text from being cut
    feed_lines = bytes([0x1B, 0x4A, 0x08])  # ESC J n
    return init + header + bytes(data) + feed_lines + cut


def print_direct_lp_device(pil_img: Image.Image, device_path: str = "/dev/usb/lp1") -> tuple[bool, str]:
    """Send image as ESC/POS Raster commands directly to /dev/usb/lpX device."""
    try:
        payload = escpos_raster_bytes(pil_img)
        with open(device_path, "wb") as f:
            f.write(payload)
        return True, f"Printed directly via {device_path}"
    except Exception as e:
        return False, f"Raw ESC/POS error: {e}"


def print_with_escpos_lib(pil_img: Image.Image) -> tuple[bool, str]:
    """Use python-escpos if available (USB or file device)."""
    if Usb is None and EscposFile is None:
        return False, "python-escpos is not installed"
    try:
        dev = None
        vendor = os.getenv("PRINTER_VENDOR_ID")
        product = os.getenv("PRINTER_PRODUCT_ID")
        if vendor and product and Usb is not None:
            dev = Usb(int(vendor, 16), int(product, 16), timeout=0, in_ep=0x81, out_ep=0x03)
        elif EscposFile is not None and os.path.exists("/dev/usb/lp1"):
            dev = EscposFile("/dev/usb/lp1")
        elif EscposFile is not None and os.path.exists("/dev/usb/lp0"):
            dev = EscposFile("/dev/usb/lp0")

        if dev is None:
            return False, "Could not find a suitable port for python-escpos"

        dev.image(pil_img)
        try:
            dev.cut()
        except Exception:
            pass
        dev.close()
        return True, "Printed via python-escpos"
    except Exception as e:
        return False, f"python-escpos error: {e}"


def print_with_lp(pil_img: Image.Image) -> tuple[bool, str]:
    """Fallback to CUPS via lp by printing a PNG."""
    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            path = tmp.name
            pil_img.save(path, "PNG")
        printer = os.getenv("RECEIPT_PRINTER")
        cmd = ["lp"]
        if printer:
            cmd += ["-d", printer]
        cmd += ["-o", "fit-to-page", path]
        subprocess.run(cmd, check=True)
        return True, "Sent to CUPS (lp)"
    except Exception as e:
        return False, f"CUPS/lp error: {e}"
    finally:
        if path and os.path.exists(path):
            try:
                os.unlink(path)
            except Exception:
                pass


def create_receipt_image(data: dict) -> Image.Image:
    """Create a receipt image from the data + logo URL if any."""
    lines = build_lines(data)
    logo_url = data.get("logo_url")
    return layout_receipt(lines, logo_url=logo_url)


@app.route("/api/print/receipt", methods=["POST"])
def handle_print_request():
    try:
        data = request.json
        if not data or "type" not in data:
            return jsonify({"error": "Invalid request data"}), 400

        # Link your logo (optional) - can also be placed in the request
        if "logo_url" not in data:
            data["logo_url"] = os.getenv("RECEIPT_LOGO_URL", "")

        img = create_receipt_image(data)

        # 1) Direct printing to /dev/usb/lp1 (ESC/POS Raster)
        ok, msg = print_direct_lp_device(img, device_path=data.get("device_path", "/dev/usb/lp1"))

        # 2) If failed, try python-escpos if available
        if not ok:
            ok2, msg2 = print_with_escpos_lib(img)
            if ok2:
                return jsonify({"message": msg2}), 200

            # 3) If failed, CUPS/lp
            ok3, msg3 = print_with_lp(img)
            if ok3:
                return jsonify({"message": msg3}), 200

            # 4) All failed: save a preview
            preview = os.path.join(
                tempfile.gettempdir(),
                f"receipt_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.png",
            )
            img.save(preview, "PNG")
            return (
                jsonify(
                    {
                        "error": "Printing failed by all methods",
                        "raw_error": msg,
                        "escpos_error": msg2,
                        "cups_error": msg3,
                        "saved_preview": preview,
                    }
                ),
                500,
            )

        return jsonify({"message": msg}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/transliterate", methods=["POST"])
def handle_transliterate_request():
    """
    This API endpoint is no longer active as the main printer code
    now correctly handles both Arabic and English characters without transliteration.
    """
    return jsonify({"error": "Transliteration API is disabled as it's no longer needed."}), 400


if __name__ == "__main__":
    # The logo URL can be set via an environment variable RECEIPT_LOGO_URL
    # Example: export RECEIPT_LOGO_URL="https://redoxcsl.web.app/assets/redox-icon.png"
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5000"))
    app.run(host=host, port=port)
