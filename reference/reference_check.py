"""Reference implementation of SPEC.md logic (for checking the Antigravity build)."""
import pandas as pd, numpy as np, itertools, json
pd.set_option('display.width',250)
SPEC={'GOLDM':(100,10,.995),'GOLDTEN':(10,10,.999),'GOLDGUINEA':(8,8,.999),'GOLDPETAL':(1,1,.999)}
import sys
CSV=sys.argv[1] if len(sys.argv)>1 else 'data/raw/gold_bhavcopy_clean.csv'
r=pd.read_csv(CSV,parse_dates=['date','expiry_date']).rename(columns={'expiry_date':'expiry','volume_lots':'vol','open_interest_lots':'oi'})
r['lot_g']=r.symbol.map(lambda s:SPEC[s][0]); r['quote_g']=r.symbol.map(lambda s:SPEC[s][1]); r['purity']=r.symbol.map(lambda s:SPEC[s][2])
r['px']=r.close/r.quote_g/r.purity
r['no_trade']=(r.vol==0)|r.open.isna()|(r.open==0)
r['thin']=(r.vol<25)|(r.oi<50)
r=r.sort_values(['symbol','expiry','date']).reset_index(drop=True)
dates=np.array(sorted(r.date.unique()))
tdi={d:i for i,d in enumerate(dates)}
r['ti']=r.date.map(tdi)
# trading days to expiry (count of trading dates in data between date and expiry)
# trading days to expiry: count trading dates in the data; beyond the last data date, count weekdays (np.busday_count)
last=dates[-1]
def _td(x):
    e=np.datetime64(x.expiry,'D')
    if e<=np.datetime64(last,'D'): return np.searchsorted(dates,np.datetime64(x.expiry),side='right')-x.ti-1
    return (len(dates)-1-x.ti)+int(np.busday_count(np.datetime64(last,'D')+1,e+1))
r['td_to_exp']=r.apply(_td,axis=1)
r['oi_prev']=r.groupby(['symbol','expiry']).oi.shift(1)
P=r.set_index(['symbol','expiry','date'])
# ---------- carry from GOLDPETAL calendar
pet=r[(r.symbol=='GOLDPETAL')&~r.no_trade][['date','expiry','px','oi_prev']]
cc=pet.merge(pet,on='date',suffixes=('_n','_f')); cc=cc[cc.expiry_f>cc.expiry_n].dropna()
cc['c']=np.log(cc.px_f/cc.px_n)*365/(cc.expiry_f-cc.expiry_n).dt.days
cc['m']=np.minimum(cc.oi_prev_n,cc.oi_prev_f)
cc=cc.loc[cc.groupby('date').m.idxmax()].set_index('date')
carry=pd.Series(index=pd.DatetimeIndex(dates),dtype=float); carry.loc[cc.index]=cc.c; carry=carry.ffill().fillna(0.06)
print('carry %: median',round(cc.c.median()*100,2),'IQR',np.round(cc.c.quantile([.25,.75]).values*100,2))
# ---------- pairs
PAIRS={'GUINEA_PETAL':('GOLDGUINEA','GOLDPETAL',0),'TEN_PETAL':('GOLDTEN','GOLDPETAL',0),'GUINEA_TEN':('GOLDGUINEA','GOLDTEN',0),
       'M_PETAL':('GOLDM','GOLDPETAL',25),'M_TEN':('GOLDM','GOLDTEN',25),'M_GUINEA':('GOLDM','GOLDGUINEA',25)}
def build(a,b,maxgap):
    A=r[r.symbol==a][['date','expiry','px','vol','oi','oi_prev','no_trade','thin','td_to_exp']]; B=r[r.symbol==b][['date','expiry','px','vol','oi','oi_prev','no_trade','thin','td_to_exp']]
    x=A.merge(B,on='date',suffixes=('_a','_b')); x['gap']=(x.expiry_a-x.expiry_b).dt.days
    x=x[(x.gap==0) if maxgap==0 else (x.gap.abs()<=maxgap)]
    x=x[~x.no_trade_a & ~x.no_trade_b].dropna(subset=['oi_prev_a','oi_prev_b'])
    x['m']=np.minimum(x.oi_prev_a,x.oi_prev_b); x=x.loc[x.groupby('date').m.idxmax()].sort_values('date').reset_index(drop=True)
    x['c']=carry.reindex(x.date).values
    x['spread']=(x.px_a/x.px_b-1-x.c*x.gap/365)*1e4
    x['roll']=(x.expiry_a!=x.expiry_a.shift())|(x.expiry_b!=x.expiry_b.shift()); x.loc[0,'roll']=False
    return x
series={k:build(*v) for k,v in PAIRS.items()}
print('\nSpread stats (bps):')
for k,x in series.items():
    print(f'{k:13s} n={len(x):4d} {x.date.min().date()}→{x.date.max().date()} mean={x.spread.mean():7.1f} sd={x.spread.std():5.1f} ac1(dS)={x.spread.diff().autocorr():+.2f} last={x.spread.iloc[-1]:7.1f}')
# ---------- costs
NOTIONAL=1_000_000
TENDER_BUFFER_TD=4
def leg_cost_rs(notional,side_buy,slip_bps,thin,n_orders=1):
    brok=20*n_orders; exch=notional*0.000021; sebi=notional*1e-6
    gst=0.18*(brok+exch+sebi); ctt=0 if side_buy else notional*1e-4; stamp=notional*2e-5 if side_buy else 0
    slip=notional*slip_bps*(3 if thin else 1)/1e4
    return brok+exch+sebi+gst+ctt+stamp+slip
# ---------- backtest
TRAIN_END=pd.Timestamp('2025-09-30')
def run(k,W,ze,mh,slip,zx=0.5,start=None,end=None):
    a,b,_=PAIRS[k]; x=series[k].copy()
    mu=x.spread.rolling(W).mean().shift(1); sd=x.spread.rolling(W).std().shift(1); x['z']=(x.spread-mu)/sd; x['mu']=mu; x['sd']=sd
    if start is not None: x=x[(x.date>=start)]
    if end is not None: x=x[(x.date<=end)]
    x=x.reset_index(drop=True); n=len(x); trades=[]; i=0
    def row(sym,exp,d):
        try: return P.loc[(sym,exp,d)]
        except KeyError: return None
    while i<n-1:
        z=x.z[i]
        ok=(not np.isnan(z)) and abs(z)>=ze and x.vol_a[i]>=25 and x.vol_b[i]>=25 and x.oi_a[i]>=50 and x.oi_b[i]>=50 \
           and x.td_to_exp_a[i]>=7 and x.td_to_exp_b[i]>=7 and not x.roll[i]
        if not ok: i+=1; continue
        ea,eb=x.expiry_a[i],x.expiry_b[i]; d1=dates[tdi[x.date[i]]+1] if tdi[x.date[i]]+1<len(dates) else None
        if d1 is None: break
        ra,rb=row(a,ea,d1),row(b,eb,d1)
        if ra is None or rb is None or ra.no_trade or rb.no_trade: i+=1; continue
        side=-np.sign(z)  # +1 = long A short B
        # hold: walk forward on series rows while same contracts
        j=x.index[x.date==d1]; j=j[0] if len(j) else i+1
        k_=j; reason='end'
        while True:
            if k_>=n-1: reason='data_end'; break
            if x.expiry_a[k_]!=ea or x.expiry_b[k_]!=eb: k_-=1; reason='roll'; break
            zz=x.z[k_]
            if min(x.td_to_exp_a[k_],x.td_to_exp_b[k_])<=TENDER_BUFFER_TD: reason='expiry'; break
            if not np.isnan(zz) and abs(zz)<=zx: reason='revert'; break
            if not np.isnan(zz) and abs(zz)>=ze+1.5: reason='stop'; break
            if tdi[x.date[k_]]-tdi[d1]>=mh: reason='time'; break
            k_+=1
        k_=max(k_,j)
        dx=dates[tdi[x.date[k_]]+1] if tdi[x.date[k_]]+1<len(dates) else x.date[k_]
        xa,xb=row(a,ea,dx),row(b,eb,dx)
        if xa is None or xb is None or xa.no_trade or xb.no_trade:
            dx=x.date[k_]; xa,xb=row(a,ea,dx),row(b,eb,dx)
        # sizing: equal grams, ~NOTIONAL per leg
        g=SPEC[a][0]*SPEC[b][0]/np.gcd(SPEC[a][0],SPEC[b][0])
        units=max(1,round(NOTIONAL/(g*ra.px))); grams=g*units
        la,lb=grams/SPEC[a][0],grams/SPEC[b][0]
        pnl_a=side*grams*(xa.close-ra.close)/SPEC[a][1]; pnl_b=-side*grams*(xb.close-rb.close)/SPEC[b][1]
        gross=pnl_a+pnl_b
        # gold attribution via net pure grams * ref change (PETAL ref = leg b if PETAL else use leg b px)
        net_pure=side*grams*SPEC[a][2]-side*grams*SPEC[b][2]
        gold=net_pure*(xb.px-rb.px)
        notA,notB=grams*ra.px*SPEC[a][2],grams*rb.px*SPEC[b][2]
        cost=0
        for notl,buy_first,thin in [(notA,side>0,ra.thin),(notB,side<0,rb.thin)]:
            cost+=leg_cost_rs(notl,buy_first,slip,thin)+leg_cost_rs(notl,not buy_first,slip,thin)
        trades.append(dict(pair=k,sig=x.date[i],entry=d1,exit=dx,expA=ea.date(),expB=eb.date(),z=round(z,2),side=int(side),grams=grams,
            notional=round(notA),gross=gross,gold=gold,spread_pnl=gross-gold,cost=cost,net=gross-cost,gross_bps=gross/notA*1e4,net_bps=(gross-cost)/notA*1e4,reason=reason,days=tdi[dx]-tdi[d1]))
        i=x.index[x.date==x.date[k_]][0]+1
    return pd.DataFrame(trades)
grid=list(itertools.product([10,20,30],[1.5,2.0,2.5],[5,10]))
res=[]
for k in PAIRS:
    for W,ze,mh in grid:
        for seg,(s,e) in {'train':(None,TRAIN_END),'test':(TRAIN_END+pd.Timedelta(days=1),None)}.items():
            # warm-up: compute z on full series, then restrict (z uses only past anyway)
            t=run(k,W,ze,mh,5)
            t=t[(t.entry<=TRAIN_END)] if seg=='train' else t[(t.entry>TRAIN_END)]
            res.append(dict(pair=k,W=W,ze=ze,mh=mh,seg=seg,n=len(t),net=t.net.sum() if len(t) else 0,net_bps=t.net_bps.mean() if len(t) else np.nan))
res=pd.DataFrame(res)
best=res[res.seg=='train'].sort_values('net',ascending=False).groupby('pair').head(1).set_index('pair')[['W','ze','mh']]
print('\nChosen on TRAIN (5 bps slippage):'); print(best)
out={}
alltr=[]
for k,(W,ze,mh) in best.iterrows():
    for slip in [0,2,5,10]:
        t=run(k,int(W),ze,int(mh),slip); t['seg']=np.where(t.entry<=TRAIN_END,'train','test'); t['slip']=slip; alltr.append(t)
alltr=pd.concat(alltr)
summ=alltr.groupby(['pair','slip','seg']).agg(n=('net','size'),gross_bps=('gross_bps','mean'),net_bps=('net_bps','mean'),net_rs=('net','sum'),gold_rs=('gold','sum'),spread_rs=('spread_pnl','sum'),cost_rs=('cost','sum'),hit=('net',lambda s:(s>0).mean())).round(1)
print('\n'+summ.to_string())
# t-stat test segment 5bps
from scipy import stats
print('\nTEST segment, 5 bps: t-stat & bootstrap CI of net bps/trade')
rng=np.random.default_rng(0)
for k in PAIRS:
    t=alltr[(alltr.pair==k)&(alltr.slip==5)&(alltr.seg=='test')].net_bps.values
    if len(t)<3: print(k,'n',len(t)); continue
    bs=[rng.choice(t,len(t)).mean() for _ in range(5000)]
    print(f'{k:13s} n={len(t):3d} mean={t.mean():6.1f} t={stats.ttest_1samp(t,0).statistic:5.2f} CI95=[{np.percentile(bs,2.5):6.1f},{np.percentile(bs,97.5):6.1f}]')
# breakeven slippage (test)
print('\nBreak-even slippage (bps/leg/side) on TEST:')
for k in PAIRS:
    t0=alltr[(alltr.pair==k)&(alltr.slip==0)&(alltr.seg=='test')]; t10=alltr[(alltr.pair==k)&(alltr.slip==10)&(alltr.seg=='test')]
    if len(t0)==0: continue
    a0,a10=t0.net.sum(),t10.net.sum(); be=10*a0/(a0-a10) if a0>0 and a0!=a10 else 0
    print(f'{k:13s} net@0={a0:10.0f} net@10={a10:10.0f} breakeven≈{be:4.1f} bps')
alltr.to_csv('reference_trades.csv',index=False); res.to_csv('reference_grid.csv',index=False)
summ.to_csv('reference_summary.csv')
