"""A minimal FIT file writer, just enough to produce test fixtures.

FIT is a binary format: a header, a stream of definition/data messages, and a CRC.
See the FIT SDK protocol description for the layout used here.
"""

from __future__ import annotations

import struct
from datetime import UTC, datetime

_FIT_EPOCH = datetime(1989, 12, 31, tzinfo=UTC)
_SEMICIRCLES_PER_DEGREE = 2**31 / 180
_CRC_TABLE = (
    0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
    0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400,
)  # fmt: skip

SPORT_NUMBERS = {"generic": 0, "running": 1, "cycling": 2, "walking": 11}

# FIT base types: (type id, struct format)
_ENUM, _SINT32, _UINT32 = (0x00, "B"), (0x85, "<i"), (0x86, "<I")


def _crc16(data: bytes) -> int:
    crc = 0
    for byte in data:
        for nibble in (byte & 0xF, byte >> 4):
            crc = ((crc >> 4) & 0x0FFF) ^ _CRC_TABLE[crc & 0xF] ^ _CRC_TABLE[nibble]
    return crc


def _message(local_type: int, global_number: int, fields: list[tuple[int, tuple[int, str], int]]):
    """Return (definition, data) bytes for one message; fields are (number, type, value)."""
    definition = struct.pack("<BBBHB", 0x40 | local_type, 0, 0, global_number, len(fields))
    data = bytes([local_type])
    for number, (type_id, fmt), value in fields:
        size = struct.calcsize(fmt)
        definition += struct.pack("<BBB", number, size, type_id)
        data += struct.pack(fmt, value)
    return definition, data


def fit_bytes(
    points: list[tuple[float, float]], *, start: datetime, sport: str | None = "running"
) -> bytes:
    """Encode ``(lon, lat)`` points, one per second from ``start``, as a FIT activity file."""
    body = b""
    if sport is not None:
        definition, data = _message(0, 12, [(0, _ENUM, SPORT_NUMBERS[sport])])
        body += definition + data
    first = int((start - _FIT_EPOCH).total_seconds())
    for i, (lon, lat) in enumerate(points):
        definition, data = _message(
            1,
            20,
            [
                (253, _UINT32, first + i),
                (0, _SINT32, round(lat * _SEMICIRCLES_PER_DEGREE)),
                (1, _SINT32, round(lon * _SEMICIRCLES_PER_DEGREE)),
            ],
        )
        body += (definition if i == 0 else b"") + data
    header = struct.pack("<BBHI4s", 12, 0x10, 2132, len(body), b".FIT")
    return header + body + struct.pack("<H", _crc16(header + body))
