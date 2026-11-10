import hashlib
import tempfile
import unittest
import zipfile
from pathlib import Path

from import_external_skill_archives import ImportRejected, import_archive


class ImportArchiveTests(unittest.TestCase):
    def make_archive(self, root: Path, members: dict[str, bytes]) -> tuple[Path, str]:
        archive = root / "sample.zip"
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
            for name, content in members.items():
                bundle.writestr(name, content)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        return archive, digest

    def record(self, digest: str) -> dict:
        return {"archiveName": "sample.zip", "archiveSha256": digest,
                "canonicalName": "sample-skill", "version": "unversioned"}

    def test_imports_only_inert_documentation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive, digest = self.make_archive(root, {
                "SKILL.md": b"# Sample skill",
                "references/guide.md": b"# Reference",
                "scripts/run.py": b"raise SystemExit(9)",
            })
            result = import_archive(archive, self.record(digest), root / "out", False)
            target = root / "out/sample-skill/unversioned"
            self.assertEqual(result["acceptedFiles"], 2)
            self.assertFalse((target / "scripts/run.py").exists())
            self.assertTrue((target / "SKILL.md").exists())

    def test_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive, digest = self.make_archive(root, {
                "SKILL.md": b"# Sample",
                "../escape.md": b"outside",
            })
            with self.assertRaises(ImportRejected):
                import_archive(archive, self.record(digest), root / "out", False)

    def test_rejects_digest_mismatch(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive, _ = self.make_archive(root, {"SKILL.md": b"# Sample"})
            with self.assertRaisesRegex(ImportRejected, "sha256_mismatch"):
                import_archive(archive, self.record("0" * 64), root / "out", True)

    def test_rejects_missing_entrypoint(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive, digest = self.make_archive(root, {"references/guide.md": b"# Reference"})
            with self.assertRaisesRegex(ImportRejected, "missing_skill_entrypoint"):
                import_archive(archive, self.record(digest), root / "out", True)


if __name__ == "__main__":
    unittest.main()
