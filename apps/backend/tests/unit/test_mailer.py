"""Password-reset mail. No network: smtplib is replaced, so nothing leaves the machine.

Run from apps/backend: python -m unittest discover -s tests/unit -v

Regression guard: the reset OTP used to be printed to the server log only, so on a phone the
"Lupa password" flow could never finish. With SMTP configured it must reach the inbox; without
it (a dev laptop) it falls back to the log so the flow is still testable.
"""
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from core import mailer  # noqa: E402

SMTP_ENV = {"SMTP_HOST": "smtp.example.com", "SMTP_PORT": "587", "SMTP_USER": "sajiwa@example.com",
            "SMTP_PASSWORD": "app-password", "SMTP_FROM": "Sajiwa <sajiwa@example.com>"}


class ResetOtpMailTests(unittest.TestCase):
    def test_with_smtp_configured_the_otp_reaches_the_student_inbox(self):
        server = MagicMock()
        with patch.dict(os.environ, SMTP_ENV), patch.object(mailer.smtplib, "SMTP") as smtp:
            smtp.return_value.__enter__.return_value = server
            self.assertTrue(mailer.send_reset_otp("mahasiswa@students.undip.ac.id", "634428"))
        smtp.assert_called_once_with("smtp.example.com", 587, timeout=20)
        server.starttls.assert_called_once()
        server.login.assert_called_once_with("sajiwa@example.com", "app-password")
        message = server.send_message.call_args.args[0]
        self.assertEqual(message["To"], "mahasiswa@students.undip.ac.id")
        self.assertEqual(message["From"], "Sajiwa <sajiwa@example.com>")
        # Regression: with one fixed subject Gmail stacked every resend into one thread, and
        # students typed an older, already replaced code. The code in the subject keeps each
        # mail its own row, newest on top.
        self.assertIn("634428", message["Subject"])
        # Plain text for clients that show no HTML; both carry the code and its lifetime
        for kind in ("plain", "html"):
            body = message.get_body((kind,)).get_content()
            self.assertIn("634428", body)
            self.assertIn("15 menit", body)

    def test_the_html_mail_carries_the_banner_inside_it(self):
        # Gmail drops data: URIs and blocks remote images by default; an attached cid image shows
        server = MagicMock()
        with patch.dict(os.environ, SMTP_ENV), patch.object(mailer.smtplib, "SMTP") as smtp:
            smtp.return_value.__enter__.return_value = server
            mailer.send_reset_otp("mahasiswa@example.com", "634428")
        message = server.send_message.call_args.args[0]
        logo = next(part for part in message.walk() if part.get_content_type() == "image/png")
        cid = logo["Content-ID"].strip("<>")
        self.assertIn(f'src="cid:{cid}"', message.get_body(("html",)).get_content())

    def test_without_smtp_the_otp_goes_to_the_server_log_and_nothing_is_sent(self):
        env = {k: v for k, v in os.environ.items() if not k.startswith("SMTP_")}
        with patch.dict(os.environ, env, clear=True), patch.object(mailer.smtplib, "SMTP") as smtp, \
                patch("builtins.print") as log:
            self.assertFalse(mailer.send_reset_otp("mahasiswa@example.com", "111222"))
        smtp.assert_not_called()
        self.assertIn("111222", " ".join(str(a) for a in log.call_args.args))

    def test_a_failing_mail_server_is_reported_not_raised(self):
        with patch.dict(os.environ, SMTP_ENV), patch.object(mailer.smtplib, "SMTP", side_effect=OSError("refused")), \
                patch("builtins.print") as log:
            self.assertFalse(mailer.send_reset_otp("mahasiswa@example.com", "333444"))
        logged = " ".join(str(a) for a in log.call_args.args)
        self.assertIn("refused", logged)
        self.assertNotIn("333444", logged)


if __name__ == "__main__":
    unittest.main()
