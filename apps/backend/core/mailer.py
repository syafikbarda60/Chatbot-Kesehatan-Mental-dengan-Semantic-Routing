"""Outgoing email over SMTP, standard library only.

Configured by SMTP_HOST / SMTP_PORT (587, STARTTLS) / SMTP_USER / SMTP_PASSWORD / SMTP_FROM.
With no SMTP_HOST (a dev laptop) the message is printed to the server log instead, so the
reset flow can still be finished by hand. A failure is logged, never raised: the caller runs
this after the response, and the response must not reveal whether an address is registered.
"""
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import make_msgid
from pathlib import Path

# The banner (mascot in a light circle on navy) rides inside the mail as a cid attachment: Gmail
# ignores data: URIs and hides remote images until the reader allows them, and there is no public host
BANNER = Path(__file__).resolve().parent.parent / "assets" / "email-banner.png"
NAVY = "#26356E"


def _reset_body(otp: str) -> str:
    return (
        "Halo,\n\n"
        f"Kode untuk mengatur ulang kata sandi Sajiwa kamu: {otp}\n\n"
        "Kode ini berlaku 15 menit dan hanya bisa dipakai sekali. Masukkan di aplikasi pada layar "
        "Lupa kata sandi.\n\n"
        "Kalau kamu meminta kode lebih dari sekali, pakai kode dari email terbaru; kode sebelumnya "
        "otomatis tidak berlaku.\n\n"
        "Kalau kamu tidak meminta reset, abaikan email ini; kata sandimu tidak berubah.\n\n"
        "Salam,\nSajiwa"
    )


def _reset_html(otp: str, banner_cid: str) -> str:
    # Tables and inline styles only: that is all mail clients reliably render
    font = "'Plus Jakarta Sans',Segoe UI,Helvetica,Arial,sans-serif"
    return f"""<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#E4E8EE;">
<div style="display:none;max-height:0;overflow:hidden;">Kode reset kata sandimu: {otp}. Berlaku 15 menit.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E4E8EE;">
<tr><td align="center" style="padding:28px 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:24px;overflow:hidden;font-family:{font};">
    <tr><td align="center" style="background:{NAVY};padding:28px 24px 0;">
      <div style="color:#C9D3F0;font-size:12px;font-weight:700;letter-spacing:3px;">SAJIWA</div>
      <div style="color:#FFFFFF;font-size:22px;font-weight:800;line-height:30px;margin-top:6px;">Atur ulang kata sandimu</div>
    </td></tr>
    <tr><td align="center" style="background:{NAVY};padding:0;">
      <img src="cid:{banner_cid}" width="520" alt="Maskot Sajiwa" style="display:block;width:100%;max-width:520px;height:auto;border:0;">
    </td></tr>
    <tr><td style="padding:28px 32px 8px;color:#1F2937;font-size:15px;line-height:24px;">
      <p style="margin:0 0 14px;">Halo,</p>
      <p style="margin:0 0 20px;">Kami menerima permintaan untuk mengatur ulang kata sandi akun Sajiwa kamu. Masukkan kode ini di layar <b>Lupa kata sandi</b> pada aplikasi:</p>
    </td></tr>
    <tr><td align="center" style="padding:0 32px;">
      <div style="background:#EEF2FB;border:2px dashed {NAVY};border-radius:16px;padding:16px 8px;color:{NAVY};font-size:34px;font-weight:800;letter-spacing:10px;font-family:Consolas,Menlo,monospace;">{otp}</div>
      <div style="color:#6B7280;font-size:13px;margin-top:10px;">Berlaku 15 menit dan hanya bisa dipakai sekali.<br>Minta kode lagi? Pakai kode dari email terbaru.</div>
    </td></tr>
    <tr><td style="padding:24px 32px 28px;">
      <div style="background:#FFF7ED;border-radius:14px;padding:14px 16px;color:#7C2D12;font-size:13px;line-height:20px;">
        Bukan kamu yang meminta? Abaikan email ini; kata sandimu tidak berubah. Jangan bagikan kode ini ke siapa pun, termasuk yang mengaku dari Sajiwa.
      </div>
    </td></tr>
    <tr><td align="center" style="border-top:1px solid #E5E7EB;padding:18px 32px 24px;color:#9CA3AF;font-size:12px;line-height:18px;">
      Salam hangat, <b style="color:{NAVY};">Sajiwa</b><br>Email ini dikirim otomatis, jangan dibalas.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>"""


def send_reset_otp(to: str, otp: str) -> bool:
    """True when the mail server accepted the message."""
    host = os.getenv("SMTP_HOST")
    if not host:
        print(f"[reset-password] SMTP belum diatur; OTP untuk {to}: {otp}", flush=True)
        return False
    message = EmailMessage()
    message["From"] = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER", "")
    message["To"] = to
    # The code in the subject keeps every resend its own inbox row, newest on top; one fixed
    # subject let Gmail stack them into a thread where students typed an older, replaced code
    message["Subject"] = f"{otp} adalah kode reset kata sandi Sajiwa"
    message.set_content(_reset_body(otp))
    banner_cid = make_msgid(domain="sajiwa")[1:-1]
    message.add_alternative(_reset_html(otp, banner_cid), subtype="html")
    message.get_body(("html",)).add_related(BANNER.read_bytes(), "image", "png", cid=f"<{banner_cid}>")
    try:
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=20) as server:
            server.starttls(context=ssl.create_default_context())
            if os.getenv("SMTP_USER"):
                server.login(os.environ["SMTP_USER"], os.getenv("SMTP_PASSWORD", ""))
            server.send_message(message)
        return True
    except (OSError, smtplib.SMTPException) as exc:
        # The OTP stays out of this line: a mail outage must not put live codes in the logs
        print(f"[reset-password] email ke {to} gagal dikirim: {exc}", flush=True)
        return False
