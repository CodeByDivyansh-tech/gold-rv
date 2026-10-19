"""Checks for pipeline/import_csv.py: MCX website CSV files -> the raw store, without ever changing stored rows."""
import os
import tempfile

import pandas as pd
import pytest

from pipeline import import_csv as ic
from pipeline.download import RAW_COLS, merge_raw

HEAD = 'Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close,Volume(Lots),Volume(In 000\'s),Value(Lacs),Open Interest(Lots)\n'
ROWS = ('"06 Oct 2026","FUTCOM","GOLDM        ","05APR2027","-","0","154658.00","155512.00","154658.00","154993.00","153177.00","3","0.300 GRMS ","46.50","2"\n'
        '"09 Oct 2026","FUTCOM","GOLDM        ","05APR2027","-","0","","","","154999.00","154999.00","0","0.000 GRMS ","0.00","4"\n')


def _write(text):
    f = tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False)
    f.write(text); f.close()
    return f.name


def test_site_csv_converts_to_the_endpoint_format():
    r = ic.read_site_csv(_write(HEAD + ROWS))
    assert list(r.columns) == RAW_COLS
    first = r.iloc[0]
    assert (first['Date'], first['Symbol'], first['ExpiryDate']) == ('10/06/2026', 'GOLDM', '05APR2027')
    assert (first['Open'], first['Close'], first['Volume'], first['OpenInterest']) == ('154658', '154993', '3', '2')
    assert first['VolumeInThousands'] == '0.300 GRMS'
    no_trade = r.iloc[1]                        # a day with no trades: blank open/high/low become 0, like MCX's endpoint
    assert (no_trade['Open'], no_trade['High'], no_trade['Low'], no_trade['Close']) == ('0', '0', '0', '154999')


def test_bad_files_are_refused():
    with pytest.raises(ValueError):            # high below the close on a traded day
        ic.read_site_csv(_write(HEAD + ROWS.replace('"155512.00","154658.00","154993.00"', '"154700.00","154658.00","154993.00"', 1)))
    with pytest.raises(ValueError):            # not a gold contract
        ic.read_site_csv(_write(HEAD + ROWS.replace('GOLDM        ', 'SILVERM      ')))
    with pytest.raises(ValueError):            # not a Bhavcopy file at all
        ic.read_site_csv(_write('a,b\n1,2\n'))


def test_a_changed_number_for_a_stored_row_stops_the_import():
    r = ic.read_site_csv(_write(HEAD + ROWS))
    changed = r.copy(); changed.loc[0, 'Close'] = '154994'
    with pytest.raises(ValueError):
        merge_raw(r.astype(str), changed.astype(str))
    assert len(merge_raw(r.astype(str), r.astype(str))) == len(r)      # the same rows twice are kept once


def test_imported_october_rows_are_in_the_clean_data_and_match_the_archive():
    clean = pd.read_csv('data/raw/gold_bhavcopy_clean.csv')
    arch = sorted(os.listdir(ic.ARCHIVE)) if os.path.isdir(ic.ARCHIVE) else []
    for name in arch:
        r = ic.read_site_csv(os.path.join(ic.ARCHIVE, name))
        sym, exp = r['Symbol'].iloc[0], pd.to_datetime(r['ExpiryDate'].iloc[0], format='%d%b%Y').strftime('%Y-%m-%d')
        c = clean[(clean['symbol'] == sym) & (clean['expiry_date'] == exp)].set_index('date')
        for _, row in r.iterrows():
            d = pd.to_datetime(row['Date'], format='%m/%d/%Y').strftime('%Y-%m-%d')
            assert c.loc[d, 'close'] == int(row['Close']), (name, d)
