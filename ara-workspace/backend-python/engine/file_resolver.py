"""
ARA Self Rec — File Resolver
-------------------------------
Resolves a source definition (upload_id or file_name) to an absolute path
on disk so that the reconciliation engine can open the file with pandas.

Resolution order:
  1. If upload_id is provided → look in <workspace>/uploads/<upload_id>.*
     (the TypeScript backend writes uploaded files there with a UUID stem)
  2. If file_name is provided → look in <workspace>/input/<file_name>
     (pre-loaded reference files used in development / testing)
  3. Raise FileNotFoundError with a descriptive message if neither resolves.

The workspace root is detected relative to this file:
  backend-python/engine/file_resolver.py
  → backend-python/engine/
  → backend-python/
  → ara-workspace/        ← workspace_root
"""

from __future__ import annotations

import glob
import logging
import os
from pathlib import Path

from models.recon_run_contract import ReconSourceDefinition

logger = logging.getLogger(__name__)

# backend-python/engine/ → backend-python/ → ara-workspace/
_ENGINE_DIR = Path(__file__).resolve().parent          # engine/
_PYTHON_DIR = _ENGINE_DIR.parent                       # backend-python/
_WORKSPACE_ROOT = _PYTHON_DIR.parent                   # ara-workspace/

_UPLOADS_DIR = _WORKSPACE_ROOT / "uploads"
_INPUT_DIR = _WORKSPACE_ROOT / "input"


class FileResolver:
    """Resolves a ReconSourceDefinition to an absolute file path."""

    @staticmethod
    def resolve(source: ReconSourceDefinition, label: str = "") -> Path:
        """
        Return the absolute path of the file described by *source*.

        Parameters
        ----------
        source:
            The source definition from the run payload.
        label:
            A human-readable label used only in log messages (e.g. "left", "right").

        Raises
        ------
        FileNotFoundError
            If no file can be located for the given source definition.
        """
        tag = f"[{label}] " if label else ""

        # ── 1. Upload-ID resolution ──────────────────────────────────────────
        if source.upload_id:
            upload_id = source.upload_id
            # The TS backend may preserve or strip the original extension.
            # Search for any file whose stem matches the upload_id.
            pattern = str(_UPLOADS_DIR / f"{upload_id}*")
            matches = glob.glob(pattern)
            if matches:
                resolved = Path(matches[0])
                logger.info("%sResolved via upload_id=%s → %s", tag, upload_id, resolved)
                return resolved
            logger.warning(
                "%supload_id=%s not found in %s — falling back to fileName",
                tag, upload_id, _UPLOADS_DIR,
            )

        # ── 2. File-name resolution (input/ directory fallback) ──────────────
        if source.file_name:
            candidate = _INPUT_DIR / source.file_name
            if candidate.exists():
                logger.info("%sResolved via fileName=%s → %s", tag, source.file_name, candidate)
                return candidate
            logger.warning(
                "%sfileName=%s not found in %s",
                tag, source.file_name, _INPUT_DIR,
            )

        # ── 3. Nothing worked ────────────────────────────────────────────────
        detail_parts: list[str] = []
        if source.upload_id:
            detail_parts.append(f"upload_id={source.upload_id!r} in {_UPLOADS_DIR}")
        if source.file_name:
            detail_parts.append(f"fileName={source.file_name!r} in {_INPUT_DIR}")
        detail = " or ".join(detail_parts) if detail_parts else "no upload_id or fileName provided"

        raise FileNotFoundError(
            f"{tag}Could not locate source file: {detail}"
        )

    @staticmethod
    def supported_extensions() -> frozenset[str]:
        """Return the set of file extensions the engine can read."""
        return frozenset({".csv", ".tsv", ".xlsx", ".xls"})
