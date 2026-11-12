# Scene source: Pillow-drawn frames synced to narration/timings.json
import json, wave, subprocess, re, sys
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg
W,H,FPS=1280,720,24
BG=(20,22,30); FG=(235,238,245); DIM=(130,138,155); ACC=(255,209,102); BLU=(76,201,240); RED=(239,71,111); GRN=(6,214,160); PANEL=(34,38,52)
FD='/usr/share/fonts/truetype/dejavu/'
_f={}
def font(s,b=False):
    k=(s,b)
    if k not in _f: _f[k]=ImageFont.truetype(FD+('DejaVuSans-Bold.ttf' if b else 'DejaVuSans.ttf'),s)
    return _f[k]
def mono(s):
    k=('m',s)
    if k not in _f: _f[k]=ImageFont.truetype(FD+'DejaVuSansMono.ttf',s)
    return _f[k]
def clamp(x): return max(0,min(1,x))

class C:
    def __init__(s,p): s.p=p; s.img=Image.new('RGB',(W,H),BG)
    def show(s,start,fn,dur=0.04):
        a=clamp((s.p-start)/dur)
        if a<=0: return
        L=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(L); fn(d)
        if a<1:
            al=L.getchannel('A').point(lambda v:int(v*a)); L.putalpha(al)
        s.img.paste(L,(0,0),L)
def T(d,xy,t,size=28,col=FG,b=False,anchor='la',m=False):
    d.text(xy,t,font=(mono(size) if m else font(size,b)),fill=col,anchor=anchor)
def lines(d,x,y,ls,size=26,col=FG,gap=1.5,b=False,anchor='la'):
    for i,l in enumerate(ls): T(d,(x,y+i*size*gap),l,size,col,b,anchor)
def box(d,x,y,w,h,label,col=BLU,size=24,fill=PANEL,sub=None,tc=FG):
    d.rounded_rectangle((x,y,x+w,y+h),12,fill=fill,outline=col,width=3)
    if sub:
        T(d,(x+w/2,y+h/2-size*0.6),label,size,tc,True,'mm'); T(d,(x+w/2,y+h/2+size*0.8),sub,int(size*0.7),DIM,False,'mm')
    else: T(d,(x+w/2,y+h/2),label,size,tc,True,'mm')
def arrow(d,x1,y1,x2,y2,col=DIM,w=4):
    d.line((x1,y1,x2,y2),fill=col,width=w)
    import math
    a=math.atan2(y2-y1,x2-x1)
    for da in (2.6,-2.6):
        d.line((x2,y2,x2+14*math.cos(a+da),y2+14*math.sin(a+da)),fill=col,width=w)
def title(c,t,col=ACC):
    c.show(0,lambda d:T(d,(60,36),t,36,col,True))

def s_intro(c):
    c.show(0.0,lambda d:T(d,(640,230),'BMAD',110,RED,True,'mm'))
    c.show(0.2,lambda d:T(d,(640,360),'contro',40,DIM,False,'mm'))
    c.show(0.3,lambda d:T(d,(640,470),'LEAN',110,GRN,True,'mm'))
    c.show(0.6,lambda d:T(d,(640,570),'Stessa spina dorsale, molto meno peso',30,FG,False,'mm'))
def s_weight(c):
    title(c,'BMAD v6.12.4')
    c.show(0.05,lambda d:T(d,(380,150),'29',90,RED,True,'mm'))
    c.show(0.05,lambda d:T(d,(380,225),'skill',30,DIM,False,'mm'))
    c.show(0.15,lambda d:T(d,(900,150),'~180.000',80,RED,True,'mm'))
    c.show(0.15,lambda d:T(d,(900,225),'parole di istruzioni',30,DIM,False,'mm'))
    names=['PRD','Architettura','Epiche &\nStorie','Sprint\nPlanning','Build']
    for i,n in enumerate(names):
        x=60+i*240
        def f(d,x=x,n=n,i=i):
            d.rounded_rectangle((x,300,x+190,400),12,fill=PANEL,outline=BLU,width=3)
            T(d,(x+95,350),n,24,FG,True,'mm')
            if i<4: arrow(d,x+195,350,x+235,350)
        c.show(0.3+i*0.07,f)
    c.show(0.3,lambda d:T(d,(60,270),'Catena obbligatoria',22,BLU))
    def light(d):
        T(d,(60,450),'Percorso più leggero accanto',22,GRN)
        for i,n in enumerate(['Spec','stories.yaml','Build']):
            x=60+i*240
            d.rounded_rectangle((x,485,x+190,555),12,fill=PANEL,outline=GRN,width=3); T(d,(x+95,520),n,22,FG,True,'mm')
            if i<2: arrow(d,x+195,520,x+235,520)
    c.show(0.8,light)
def s_rewrites(c):
    title(c,'Lo stesso requisito, riscritto 5 volte')
    items=['1  Brief','2  PRD','3  epics.md (copiato)','4  Criteri della storia','5  Spec di build']
    for i,n in enumerate(items):
        def f(d,i=i,n=n):
            y=110+i*88
            d.rounded_rectangle((60,y,740,y+70),12,fill=PANEL,outline=RED if i else BLU,width=3)
            T(d,(80,y+35),n,26,FG,True,'lm'); T(d,(720,y+35),'FR-7 ...',22,ACC,False,'rm',True)
        c.show(0.08+i*0.15,f)
    def side(d):
        d.rounded_rectangle((800,200,1230,330),12,fill=PANEL,outline=RED,width=3)
        T(d,(1015,240),'+ file di contesto',24,FG,True,'mm'); T(d,(1015,285),'dell\'epica',24,FG,True,'mm')
    c.show(0.85,side)
def s_ceremony(c):
    title(c,'Il rituale finale, per ogni documento')
    c.show(0.05,lambda d:box(d,60,110,300,80,'PRD · Architettura · UX',BLU,22))
    rit=['registro delle decisioni con te','subagent di riconciliazione input','revisori in parallelo','passata di rifinitura','report HTML']
    for i,n in enumerate(rit):
        def f(d,i=i,n=n):
            y=225+i*65
            d.rounded_rectangle((60,y,620,y+52),10,fill=PANEL,outline=RED,width=2); T(d,(80,y+26),n,22,FG,False,'lm')
        c.show(0.12+i*0.1,f)
    def r(d):
        d.rounded_rectangle((700,110,1230,360),12,fill=PANEL,outline=ACC,width=3)
        T(d,(730,135),'Epiche & Storie',26,ACC,True)
        T(d,(730,190),'[C] per continuare',24,FG,False,'la',True)
        T(d,(730,235),'[C] per continuare',24,FG,False,'la',True)
        T(d,(730,280),'[C] per continuare',24,FG,False,'la',True)
    c.show(0.6,r)
    def a(d):
        for i in range(5):
            d.rounded_rectangle((700+i*108,400,780+i*108,450),8,fill=PANEL,outline=RED,width=2); T(d,(740+i*108,425),'ok?',22,FG,True,'mm')
        T(d,(700,470),'approvazione di ogni singola storia',24,FG)
    c.show(0.8,a)
def s_boiler(c):
    title(c,'Ripetizioni')
    def grid(d):
        T(d,(60,100),'Routine di avvio (script, hook, saluto per nome)',24,FG,True)
        for i in range(26):
            x=60+(i%13)*46; y=145+(i//13)*50
            d.rounded_rectangle((x,y,x+38,y+38),6,fill=PANEL,outline=RED,width=2)
        T(d,(60,255),'ripetuta in 26 skill',24,RED,True)
    c.show(0.05,grid)
    def pers(d):
        T(d,(60,320),'5 agenti con nome: solo rimandi ad altre skill',24,FG,True)
        for i,n in enumerate(['John','Mary','Winston','Amelia','Sally']):
            x=60+i*150
            d.ellipse((x,365,x+100,465),fill=PANEL,outline=BLU,width=3); T(d,(x+50,415),n,19,FG,True,'mm')
            arrow(d,x+50,470,x+50,515)
        T(d,(60,530),'→ altre skill',22,DIM)
    c.show(0.38,pers)
    def rev(d):
        T(d,(860,320),'Prompt dei revisori',24,FG,True)
        for i in range(3):
            d.rounded_rectangle((880+i*110-20,370,880+i*110+80,470),8,fill=PANEL,outline=ACC,width=3)
            T(d,(880+i*110+30,420),f'copia {i+1}',20,FG,False,'mm')
        T(d,(1000,500),'≠  ≠   fuori sincrono',26,RED,True,'mm')
    c.show(0.7,rev)
def s_keep(c):
    title(c,'Il nucleo da tenere',GRN)
    cards=[('1','Cosa · Come · Fare','file su disco\ncome passaggi di consegne'),('2','Intento dall\'utente','ogni inferenza\nmarcata [ASSUMPTION]'),('3','Architettura = invarianti','Binds / Prevents / Rule')]
    for i,(n,h,s) in enumerate(cards):
        def f(d,i=i,n=n,h=h,s=s):
            x=60+i*400
            d.rounded_rectangle((x,150,x+370,470),16,fill=PANEL,outline=GRN,width=3)
            T(d,(x+30,185),n,64,GRN,True); 
            T(d,(x+30,290),h,22,FG,True)
            lines(d,x+30,350,s.split('\n'),22,DIM)
        c.show(0.05+i*0.3,f)
def s_keep2(c):
    title(c,'...e ancora, dal nucleo',GRN)
    it=[('Spec di build piccole','intento congelato + gate sulle domande aperte'),('Subagent nuovo','implementa dalla sola spec'),('3 revisori ciechi in parallelo','poi triage'),('Triage','intent_gap · bad_spec · patch · defer'),('Controllo di prontezza','prima di costruire'),('Registro del rinviato + cambi','deferred.md, lean-change')]
    for i,(a,b) in enumerate(it):
        def f(d,i=i,a=a,b=b):
            col=i%2; x=60+col*600; y=130+(i//2)*140
            d.rounded_rectangle((x,y,x+560,y+110),14,fill=PANEL,outline=GRN,width=3)
            T(d,(x+24,y+34),a,25,FG,True,'lm'); T(d,(x+24,y+76),b,20,DIM,False,'lm')
        c.show(0.04+i*0.14,f)
def s_flow(c):
    title(c,'LEAN: 7 skill',GRN)
    n=[('lean-intent','SPEC.md'),('lean-architecture','ARCHITECTURE.md'),('lean-plan','stories.yaml'),('lean-build ×N','spec + codice')]
    def idea(d): T(d,(60,230),'idea',26,DIM,True,'lm')
    c.show(0.02,idea)
    for i,(a,b) in enumerate(n):
        def f(d,i=i,a=a,b=b):
            x=130+i*285
            d.rounded_rectangle((x,170,x+235,290),14,fill=PANEL,outline=GRN if i!=1 else DIM,width=3)
            T(d,(x+117,215),a,21,FG,True,'mm'); T(d,(x+117,255),b,20,ACC,False,'mm',True)
            arrow(d,x-45,230,x-5,230)
        c.show(0.1+i*0.12,f)
    c.show(0.45,lambda d:T(d,(130+285+117,310),'opzionale per lavori piccoli',18,DIM,False,'mm'))
    def ch(d):
        d.rounded_rectangle((130,400,500,500),14,fill=PANEL,outline=BLU,width=3)
        T(d,(315,435),'lean-change',23,FG,True,'mm'); T(d,(315,472),'cambi + retrospettive',19,DIM,False,'mm')
        arrow(d,1130,295,1130,350); d.line((1130,350,315,350),fill=DIM,width=4); arrow(d,315,350,315,398)
    c.show(0.65,ch)
    def rv(d):
        d.rounded_rectangle((540,400,860,500),14,fill=PANEL,outline=BLU,width=3)
        T(d,(700,435),'lean-review',23,FG,True,'mm'); T(d,(700,472),'revisioni + lenti',19,DIM,False,'mm')
        d.rounded_rectangle((900,400,1220,500),14,fill=PANEL,outline=BLU,width=3)
        T(d,(1060,435),'lean-kit',23,FG,True,'mm'); T(d,(1060,472),'regole condivise',19,DIM,False,'mm')
    c.show(0.8,rv)
def s_replaces(c):
    title(c,'Che cosa sostituisce cosa',GRN)
    rows=[('brief · PRD · spec · PRFAQ · forge-idea · UX','lean-intent'),('epiche · sprint planning · readiness','lean-plan'),('build · build-auto','lean-build  (--auto)'),('review · code-review · prompt dei revisori','lean-review  (1 sola copia)'),('correct-course · retrospettiva','lean-change')]
    for i,(a,b) in enumerate(rows):
        def f(d,i=i,a=a,b=b):
            y=120+i*100
            d.rounded_rectangle((60,y,700,y+76),12,fill=PANEL,outline=RED,width=2); T(d,(80,y+38),a,21,FG,False,'lm')
            arrow(d,712,y+38,770,y+38,ACC)
            d.rounded_rectangle((780,y,1230,y+76),12,fill=PANEL,outline=GRN,width=3); T(d,(805,y+38),b,24,GRN,True,'lm')
        c.show(0.05+i*0.17,f)
def s_plan(c):
    title(c,'Pianificare con meno copie',GRN)
    it=[('Storie → ID dei requisiti','niente copie del testo'),('Elenco storie approvato in un solo passaggio','non una per una'),('Stato = campo in stories.yaml','niente sprint-status, niente script'),('Checkpoint sulla spec di build','solo quando serve')]
    for i,(a,b) in enumerate(it):
        def f(d,i=i,a=a,b=b):
            y=130+i*120
            d.ellipse((60,y+10,110,y+60),fill=GRN); T(d,(85,y+35),'✓',28,BG,True,'mm')
            T(d,(140,y+22),a,28,FG,True,'lm'); T(d,(140,y+62),b,22,DIM,False,'lm')
        c.show(0.05+i*0.22,f)
def s_orch(c):
    title(c,'Orchestratore e costi',GRN)
    def top(d):
        d.rounded_rectangle((380,110,900,230),16,fill=PANEL,outline=ACC,width=4)
        T(d,(640,150),'Modello di sessione (es. Opus)',26,ACC,True,'mm'); T(d,(640,195),'orchestra · fa il triage · decide · parla con te',20,FG,False,'mm')
    c.show(0.03,top)
    def w(d):
        d.rounded_rectangle((120,340,600,470),16,fill=PANEL,outline=BLU,width=3)
        T(d,(360,375),'Sonnet',28,BLU,True,'mm'); T(d,(360,425),'implement · review · check · research',20,FG,False,'mm')
        d.rounded_rectangle((680,340,1160,470),16,fill=PANEL,outline=GRN,width=3)
        T(d,(920,375),'Haiku',28,GRN,True,'mm'); T(d,(920,425),'scout (esplorazione repo, doc)',20,FG,False,'mm')
        arrow(d,500,235,380,335); arrow(d,780,235,900,335)
    c.show(0.25,w)
    c.show(0.5,lambda d:T(d,(640,520),'Livelli da lean.yaml o dal modello della sessione',22,DIM,False,'mm'))
    c.show(0.62,lambda d:T(d,(640,560),'Fallimento → si rilancia un livello più su',22,ACC,False,'mm'))
    c.show(0.78,lambda d:T(d,(640,590),'I lavoratori economici generano, il modello costoso giudica',26,GRN,True,'mm'))
def s_kiss(c):
    title(c,'KISS di default',GRN)
    it=['Codice più semplice che passa l\'accettazione','Niente astrazioni speculative','Il revisore caccia l\'over-engineering','Documenti brevi, limiti rigidi']
    for i,a in enumerate(it):
        c.show(0.05+i*0.1,lambda d,i=i,a=a:(d.ellipse((60,142+i*70,80,162+i*70),fill=GRN),T(d,(100,152+i*70),a,24,FG,False,'lm')))
    def reply(d):
        d.rounded_rectangle((720,100,1230,420),14,fill=PANEL,outline=BLU,width=3)
        T(d,(745,120),'Risposta all\'utente  (≤ 12 righe)',20,BLU,True)
        for i,l in enumerate(['stato: ...','┌──────┬──────┐','│ tabella     │','└──────┴──────┘','1) domanda  a/b/c','2) domanda  a/b/c','risposta: 1a 2b','Next: ...']):
            T(d,(745,165+i*29),l,20,FG,False,'la',True)
    c.show(0.4,reply)
    def dirty(d):
        d.rounded_rectangle((120,490,1160,600),16,fill=PANEL,outline=ACC,width=4)
        T(d,(640,525),'Sporco ≠ non verificato',36,ACC,True,'mm')
        T(d,(640,570),'KISS taglia la rifinitura, mai i controlli',24,FG,False,'mm')
    c.show(0.72,dirty)
def s_lanes(c):
    title(c,'Team in parallelo: corsie e contratti',GRN)
    def s0(d):
        d.rounded_rectangle((50,150,330,430),14,fill=PANEL,outline=ACC,width=3)
        T(d,(190,175),'Storia 0: contratti',22,ACC,True,'mm')
        lines(d,70,205,['tipi','1 fake per porta','fixture vs schema reale','test di contratto','test di confine','walking skeleton'],19,FG,1.55)
    c.show(0.05,s0)
    for i,(nm,cs) in enumerate([('A',3),('B',2),('C',3)]):
        def f(d,i=i,nm=nm,cs=cs):
            y=150+i*100
            T(d,(390,y+35),f'corsia {nm}',20,DIM,False,'lm')
            arrow(d,335,290,385,y+35)
            for k in range(cs):
                x=500+k*160
                d.rounded_rectangle((x,y+5,x+120,y+65),10,fill=PANEL,outline=BLU,width=3); T(d,(x+60,y+35),f'{nm}{k+1}',22,FG,True,'mm')
                if k<cs-1: arrow(d,x+122,y+35,x+158,y+35)
        c.show(0.25+i*0.1,f)
    def ck(d):
        d.rounded_rectangle((1000,150,1230,430),14,fill=PANEL,outline=GRN,width=3)
        T(d,(1115,175),'Ogni giunzione',22,GRN,True,'mm'); lines(d,1020,215,['un owner','regole sui valori','un checkpoint'],20,FG,1.7)
        T(d,(1115,360),'uscita: fixture',20,DIM,False,'mm'); T(d,(1115,390),'end to end',20,DIM,False,'mm')
    c.show(0.6,ck)
    c.show(0.82,lambda d:T(d,(640,500),'Modellato su un vero epic a 3 corsie, con le correzioni ai problemi visti',24,ACC,False,'mm'))
def s_close(c):
    title(c,'In numeri',GRN)
    def bars(d):
        pass
    for j,(lab,a,b,u) in enumerate([('Skill',29,7,''),('Parole di istruzioni',180,16,'k')]):
        def f(d,j=j,lab=lab,a=a,b=b,u=u):
            y=140+j*210
            T(d,(60,y),lab,28,FG,True)
            ma=max(a,b); sc=900/ma
            d.rounded_rectangle((60,y+50,60+a*sc,y+90),6,fill=RED); T(d,(70+a*sc,y+70),f'BMAD {a}{u}',24,RED,True,'lm')
            d.rounded_rectangle((60,y+110,60+max(b*sc,8),y+150),6,fill=GRN); T(d,(70+b*sc,y+130),f'LEAN {b}{u}',24,GRN,True,'lm')
        c.show(0.05+j*0.25,f)
    c.show(0.7,lambda d:T(d,(640,600),'Stessa spina dorsale, un decimo del peso',34,ACC,True,'mm'))

SCENES={'intro':s_intro,'weight':s_weight,'rewrites':s_rewrites,'ceremony':s_ceremony,'boiler':s_boiler,'keep':s_keep,'keep2':s_keep2,'flow':s_flow,'replaces':s_replaces,'plan':s_plan,'orch':s_orch,'kiss':s_kiss,'lanes':s_lanes,'close':s_close}

def caption(img,seg,p):
    sents=[x for x in re.split(r'(?<=[.:;?!])\s+',seg['text']) if x]
    # split long sentences at commas for readability
    parts=[]
    for s in sents:
        parts+= [s] if len(s)<110 else [x for x in re.split(r'(?<=,)\s+',s) if x]
    merged=[]
    for x in parts:
        if merged and len(merged[-1])+len(x)<80: merged[-1]+=' '+x
        else: merged.append(x)
    tot=sum(len(x) for x in merged); sp=seg['speech']/seg['duration']
    q=clamp(p/sp)*tot; acc=0; cur=merged[-1]
    for x in merged:
        acc+=len(x)
        if q<=acc: cur=x;break
    import textwrap
    ls=textwrap.wrap(cur,70)[:2]
    d=ImageDraw.Draw(img,'RGBA')
    d.rectangle((0,H-92,W,H),fill=(0,0,0,170))
    for i,l in enumerate(ls):
        d.text((W/2,H-70+i*34),l,font=font(25),fill=FG,anchor='mm')

if __name__=='__main__':
    tm=json.load(open('narration/timings.json'))
    only=sys.argv[1] if len(sys.argv)>1 else None
    if only=='stills':
        import os; os.makedirs('frames',exist_ok=True)
        for s in tm['segments']:
            for p in (0.5,0.97):
                c=C(p); SCENES[s['id']](c); caption(c.img,s,p*s['duration']); c.img.save(f"frames/{s['id']}_{int(p*100)}.png")
        sys.exit()
    # audio
    sr=tm['sr']; aw=wave.open('narration/all.wav','wb'); aw.setnchannels(1); aw.setsampwidth(2); aw.setframerate(sr)
    for s in tm['segments']:
        r=wave.open(s['file']); fr=r.readframes(r.getnframes()); aw.writeframes(fr)
        aw.writeframes(b'\0\0'*int((s['duration']-s['speech'])*sr))
    aw.close()
    ff=imageio_ffmpeg.get_ffmpeg_exe()
    pr=subprocess.Popen([ff,'-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i','narration/all.wav','-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-c:a','aac','-b:a','160k','-shortest','explainer.mp4'],stdin=subprocess.PIPE)
    nf=int(tm['total']*FPS)
    segs=tm['segments']; k=0
    for f in range(nf):
        t=f/FPS
        while k<len(segs)-1 and t>=segs[k+1]['start']: k+=1
        s=segs[k]; lt=t-s['start']; p=clamp(lt/s['duration'])
        c=C(p); SCENES[s['id']](c); caption(c.img,s,lt)
        pr.stdin.write(c.img.tobytes())
    pr.stdin.close(); pr.wait()
