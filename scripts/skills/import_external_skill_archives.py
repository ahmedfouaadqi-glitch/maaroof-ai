#!/usr/bin/env python3
"""Safely stage external MAAROOF skill archives as inert documentation.

This is a maintenance/import tool only. It never imports or executes package scripts.
The archive manifest must contain: {"packages":[{"archiveName": "...",
"archiveSha256": "...", "canonicalName": "...", "version": "..."}]}.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import zipfile
from pathlib import Path, PurePosixPath

ALLOWED_SUFFIXES = {".md", ".mdx", ".txt", ".json", ".csv", ".yaml", ".yml", ".canvas", ".tex", ".sty"}
MAX_ARCHIVE_BYTES = 8 * 1024 * 1024
MAX_MEMBER_BYTES = 2 * 1024 * 1024
MAX_TOTAL_BYTES = 12 * 1024 * 1024
MAX_MEMBERS = 250
MAX_COMPRESSION_RATIO = 150


class ImportRejected(ValueError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_member_name(raw: str) -> str:
    normalized = raw.replace("\\\\", "/")
    path = PurePosixPath(normalized)
    if not normalized or normalized.startswith("/") or re.match(r"^[A-Za-z]:", normalized):
        raise ImportRejected(f"absolute_or_empty_path:{raw}")
    if any(part in ("", ".", "..") for part in normalized.split("/")):
        raise ImportRejected(f"path_traversal_or_ambiguous_path:{raw}")
    if "\\x00" in normalized:
        raise ImportRejected(f"nul_in_path:{raw}")
    return path.as_posix()


def package_slug(name: str, version: str) -> str:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", name):
        raise ImportRejected(f"invalid_skill_name:{name}")
    version_slug = re.sub(r"[^a-zA-Z0-9.-]+", "-", version).strip("-") or "unversioned"
    return f"{name}/{version_slug}"


def import_archive(archive: Path, record: dict, output_root: Path, verify_only: bool) -> dict:
    if archive.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ImportRejected(f"archive_too_large:{archive.name}")
    expected = str(record.get("archiveSha256", "")).lower()
    actual = sha256_file(archive)
    if not re.fullmatch(r"[a-f0-9]{64}", expected) or actual != expected:
        raise ImportRejected(f"archive_sha256_mismatch:{archive.name}")
    total = 0
    accepted = []
    rejected_types = []
    seen = set()
    with zipfile.ZipFile(archive) as bundle:
        infos = [item for item in bundle.infolist() if not item.is_dir()]
        if len(infos) > MAX_MEMBERS:
            raise ImportRejected(f"too_many_members:{archive.name}")
        for info in infos:
            member = safe_member_name(info.filename)
            if member in seen:
                raise ImportRejected(f"duplicate_member_path:{archive.name}:{member}")
            seen.add(member)
            mode = (info.external_attr >> 16) & 0xFFFF
            if stat.S_ISLNK(mode):
                raise ImportRejected(f"symlink_member:{archive.name}:{member}")
            if info.flag_bits & 0x1:
                raise ImportRejected(f"encrypted_member:{archive.name}:{member}")
            if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                raise ImportRejected(f"unsupported_compression:{archive.name}:{member}")
            if info.file_size > MAX_MEMBER_BYTES:
                raise ImportRejected(f"member_too_large:{archive.name}:{member}")
            total += info.file_size
            if total > MAX_TOTAL_BYTES:
                raise ImportRejected(f"archive_expansion_limit:{archive.name}")
            if info.file_size and info.compress_size == 0:
                raise ImportRejected(f"invalid_compression_size:{archive.name}:{member}")
            if info.compress_size and info.file_size / info.compress_size > MAX_COMPRESSION_RATIO:
                raise ImportRejected(f"compression_ratio_limit:{archive.name}:{member}")
            suffix = Path(member).suffix.lower()
            if suffix not in ALLOWED_SUFFIXES:
                rejected_types.append(member)
                continue
            data = bundle.read(info)
            accepted.append((member, data, hashlib.sha256(data).hexdigest()))
    if not any(Path(member).name.lower() in {"skill.md", "skill_en.md"} for member, _, _ in accepted):
        raise ImportRejected(f"missing_skill_entrypoint:{archive.name}")
    if not verify_only:
        destination = output_root / package_slug(record["canonicalName"], record.get("version", "unversioned"))
        for member, data, _ in accepted:
            target = destination.joinpath(*PurePosixPath(member).parts)
            resolved = target.resolve()
            if output_root.resolve() not in resolved.parents:
                raise ImportRejected(f"output_path_escape:{member}")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    return {
        "archive": archive.name,
        "archiveSha256": actual,
        "acceptedFiles": len(accepted),
        "acceptedBytes": sum(len(data) for _, data, _ in accepted),
        "excludedExecutableOrUnsupportedFiles": len(rejected_types),
        "excludedPaths": rejected_types,
        "status": "verified" if verify_only else "imported_inert_content",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive-dir", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("src/lib/maaroof/external-skill-content"))
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    failures, results = [], []
    for record in manifest.get("packages", []):
        archive = args.archive_dir / record["archiveName"]
        try:
            results.append(import_archive(archive, record, args.output_dir, args.verify_only))
        except (OSError, KeyError, zipfile.BadZipFile, ImportRejected) as error:
            failures.append({"archive": record.get("archiveName"), "error": str(error)})
    report = {"verified": len(results), "failed": len(failures), "results": results, "failures": failures}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
