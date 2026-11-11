"""Regression protection for the exact owner-provided Indonesian Source A seed."""
import hashlib
import re
import unittest
from collections import Counter
from pathlib import Path


EXPECTED_ITEMS = [
    "Saya merasa sulit untuk beristirahat",
    "Saya merasa bibir saya sering kering",
    "Saya sama sekali tidak dapat merasakan perasaan positif",
    "Saya mengalami kesulitan bernafas (misalnya: seringkali terengah-engah atau tidak dapat bernafas padahal tidak melakukan aktivitas fisik sebelumnya)",
    "Saya merasa sulit untuk meningkatkan inisiatif dalam melakukan sesuatu",
    "Saya cenderung bereaksi berlebihan terhadap suatu situasi",
    "Saya merasa gemetar (misalnya: pada tangan)",
    "Saya merasa telah menghabiskan banyak energi untuk merasa cemas",
    "Saya merasa khawatir dengan situasi dimana saya mungkin menjadi panik dan mempermalukan diri sendiri",
    "Saya merasa tidak ada hal yang dapat diharapkan di masa depan",
    "Saya menemukan diri saya mudah gelisah",
    "Saya merasa sulit untuk bersantai",
    "Saya merasa putus asa dan sedih",
    "Saya tidak dapat memaklumi hal apapun yang menghalangi saya untuk menyelesaikan hal yang sedang saya lakukan",
    "Saya merasa saya hampir panik",
    "Saya tidak merasa antusias dalam hal apapun",
    "Saya merasa bahwa saya tidak berharga sebagai seorang manusia",
    "Saya merasa bahwa saya mudah tersinggung",
    "Saya menyadari kegiatan jantung, walaupun saya tidak sehabis melakukan aktivitas fisik (misalnya: merasa detak jantung meningkat atau melemah)",
    "Saya merasa takut tanpa alasan yang jelas",
    "Saya merasa bahwa hidup tidak berarti",
]
EXPECTED_OPTIONS = [
    "Tidak sesuai sama sekali, atau tidak pernah",
    "Sesuai sampai tingkat tertentu, atau kadang-kadang",
    "Sesuai sampai batas yang dapat dipertimbangkan, atau lumayan sering",
    "Sangat sesuai, atau sering sekali",
]
EXPECTED_MAPPING = {
    "depression": {3, 5, 10, 13, 16, 17, 21},
    "anxiety": {2, 4, 7, 9, 15, 19, 20},
    "stress": {1, 6, 8, 11, 12, 14, 18},
}
EXPECTED_HASH = "f75551c120d96236564bb704263a3eed3e647eb8a41a6a8cface95920419e7b2"


class SourceASeedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = (Path(__file__).parents[4] / "db/migrations/003_iteration4_1.sql").read_text(encoding="utf-8")
        cls.rows = [
            (int(key_number), int(position), category, wording)
            for key_number, position, category, wording in re.findall(
                r"\('DASS21-(\d{2})',(\d+),'(depression|anxiety|stress)','([^']+)'\)", cls.sql
            )
        ]

    def test_exact_twenty_one_items_and_numbering(self):
        self.assertEqual(len(self.rows), 21)
        self.assertEqual([row[0] for row in self.rows], list(range(1, 22)))
        self.assertEqual([row[1] for row in self.rows], list(range(1, 22)))
        self.assertEqual([row[3] for row in self.rows], EXPECTED_ITEMS)
        self.assertTrue(all(row[3].strip() == row[3] and row[3] for row in self.rows))
        self.assertFalse(any("placeholder" in row[3].lower() or "demo" in row[3].lower() for row in self.rows))

    def test_exact_wording_hash(self):
        digest = hashlib.sha256("\n".join(row[3] for row in self.rows).encode()).hexdigest()
        self.assertEqual(digest, EXPECTED_HASH)
        self.assertIn(EXPECTED_HASH, self.sql)

    def test_category_blueprint(self):
        actual = {category: {position for _, position, value, _ in self.rows if value == category} for category in EXPECTED_MAPPING}
        self.assertEqual(actual, EXPECTED_MAPPING)
        self.assertEqual(Counter(row[2] for row in self.rows), Counter({"depression": 7, "anxiety": 7, "stress": 7}))

    def test_exact_response_options_and_scores(self):
        options = [
            (int(position), label, int(score))
            for position, label, score in re.findall(r"\((\d),'([^']+)',(\d)\)", self.sql)
            if label in EXPECTED_OPTIONS
        ]
        self.assertEqual(options, [(index, label, index) for index, label in enumerate(EXPECTED_OPTIONS)])


if __name__ == "__main__":
    unittest.main()
