"""DASS-21 variants: whole subscales only, each scored against its official norm."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[4]
sys.path.insert(0, str(ROOT / "apps" / "backend"))

from core.dass21 import CATEGORY_ITEMS, normalize_subscales, score_dass21


def responses(score: int, subscales=tuple(CATEGORY_ITEMS)):
    return [
        {"position": position, "category": category, "score": score}
        for category in subscales for position in CATEGORY_ITEMS[category]
    ]


class SubscaleSelectionTests(unittest.TestCase):
    def test_any_non_empty_set_comes_back_in_blueprint_order(self):
        self.assertEqual(normalize_subscales(["stress", "depression"]), ("depression", "stress"))
        self.assertEqual(normalize_subscales(["anxiety"]), ("anxiety",))

    def test_empty_unknown_or_repeated_subscales_are_refused(self):
        for bad in ([], ["mood"], ["stress", "stress"]):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                normalize_subscales(bad)


class SubscaleScoringTests(unittest.TestCase):
    def test_one_subscale_is_scored_alone_with_its_official_norm(self):
        result = score_dass21(responses(2, ("stress",)), subscales=("stress",))
        self.assertEqual(set(result), {"stress"})
        # 7 items x 2 = 14 raw, doubled to 28: "severe" on the stress norm
        self.assertEqual(result["stress"], {"raw_score": 14, "scaled_score": 28, "severity": "severe"})

    def test_two_subscales_score_independently(self):
        result = score_dass21(responses(0, ("depression", "anxiety")), subscales=("depression", "anxiety"))
        self.assertEqual(set(result), {"depression", "anxiety"})

    def test_a_subscale_must_be_answered_whole(self):
        with self.assertRaises(ValueError):
            score_dass21(responses(0, ("stress",))[:-1], subscales=("stress",))

    def test_items_from_a_subscale_not_offered_are_refused(self):
        with self.assertRaises(ValueError):
            score_dass21(responses(0, ("stress", "anxiety")), subscales=("stress",))

    def test_full_instrument_is_unchanged_by_default(self):
        self.assertEqual(set(score_dass21(responses(0))), set(CATEGORY_ITEMS))


if __name__ == "__main__":
    unittest.main()
