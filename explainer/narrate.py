import json,wave,sys
from piper import PiperVoice, SynthesisConfig
v=PiperVoice.load('voices/it_IT-paola-medium.onnx')
segs=json.load(open('narration.json'))['segments']
import os; os.makedirs('narration',exist_ok=True)
out=[];t=0
GAP=0.6
for s in segs:
    p=f"narration/{s['id']}.wav"
    w=wave.open(p,'wb'); v.synthesize_wav(s['text'],w); w.close()
    r=wave.open(p); d=r.getnframes()/r.getframerate(); sr=r.getframerate()
    out.append({'id':s['id'],'text':s['text'],'file':p,'start':t,'duration':d+GAP,'speech':d}); t+=d+GAP
json.dump({'segments':out,'total':t,'sr':sr},open('narration/timings.json','w'),indent=1)
print(t)
