"""Acceptance test verifying frontend static data and absence of prohibited strings (Section 12)."""
import os
import json
import re

def test_json_files_exist_and_valid():
    """All JSON files listed in Section 8.1 exist and are valid JSON."""
    base_dir = 'frontend/public/data'
    required_files = [
        'meta.json',
        'contracts.json',
        'prices/GOLDM.json',
        'prices/GOLDTEN.json',
        'prices/GOLDGUINEA.json',
        'prices/GOLDPETAL.json',
        'curve.json',
        'carry_decomposition/GOLDM.json',
        'carry_decomposition/GOLDTEN.json',
        'carry_decomposition/GOLDGUINEA.json',
        'carry_decomposition/GOLDPETAL.json',
        'pairs.json',
        'pairs/M_PETAL.json',
        'pairs/M_TEN.json',
        'pairs/M_GUINEA.json',
        'pairs/GUINEA_PETAL.json',
        'pairs/TEN_PETAL.json',
        'pairs/GUINEA_TEN.json',
        'signals_today.json',
        'signals_history.json',
        'backtest/cost_matrix.json',
        'backtest/grid.json',
        'methodology.json',
    ]
    for rel_path in required_files:
        full_path = os.path.join(base_dir, rel_path)
        assert os.path.exists(full_path), f"Missing data file: {full_path}"
        with open(full_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            assert data is not None

def test_no_prohibited_strings_in_frontend():
    """Grep build output for '71,480', 'COMEX', 'USD/INR', 'Confidence', 'Monte Carlo' -> zero hits."""
    prohibited = [
        re.compile(r'71,?480', re.IGNORECASE),
        re.compile(r'COMEX', re.IGNORECASE),
        re.compile(r'USD/?INR', re.IGNORECASE),
        re.compile(r'Confidence', re.IGNORECASE),
        re.compile(r'Monte\s*Carlo', re.IGNORECASE),
    ]
    
    search_dirs = ['frontend/dist', 'frontend/src']
    hits = []
    
    for s_dir in search_dirs:
        if not os.path.exists(s_dir):
            continue
        for root, _, files in os.walk(s_dir):
            for file in files:
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        for p in prohibited:
                            matches = p.findall(content)
                            if matches:
                                hits.append(f"{filepath}: matches {p.pattern} -> {matches[:3]}")
                except Exception:
                    pass
                    
    assert len(hits) == 0, f"Found prohibited strings in frontend: {hits}"
