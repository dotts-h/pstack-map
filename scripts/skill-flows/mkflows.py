# Builds skill-flows.json from the real pstack files. Nothing is hand-written: every step and input carries the file line it came from.
import json,os,re,sys
if len(sys.argv)!=3:sys.exit('usage: mkflows.py <pstack root> <out.json>')
ROOT,OUT=sys.argv[1],sys.argv[2]
SK=os.path.join(ROOT,'skills');NAMES=sorted(d for d in os.listdir(SK) if os.path.isfile(os.path.join(SK,d,'SKILL.md')))
META=re.compile(r'^(outputs?|output (format|contract)|guardrails|rules|when not to use|evaluation|common failure|final response|reply|what to hand back|report|the format|where it lives|operating posture|non-negotiables|other )',re.I)
def short(t):
    t=re.sub(r'\[([^\]]+)\]\([^)]*\)',r'\1',t).strip();m=re.match(r'\*\*(.+?)\*\*',t)
    if m:t=m.group(1)
    t=re.sub(r'[*`]','',t);t=re.split(r'(?<=[.:;])\s',t)[0].rstrip('.:;')
    return t if len(t)<=64 else t[:61].rsplit(' ',1)[0]+'…'
def h2(L):return [(i,l[3:].strip()) for i,l in enumerate(L) if l.startswith('## ')]
def numbered(L,a,b):return [(i,re.sub(r'^\d+\.\s+','',l)) for i,l in enumerate(L[a:b],a) if re.match(r'^\d+\.\s',l)]
def steps(L):
    H=h2(L);ends={i:(H[k+1][0] if k+1<len(H) else len(L)) for k,(i,_) in enumerate(H)}
    for i,t in H:
        if t.lower()=='start':
            n=numbered(L,i,ends[i])
            if n:return 'numbered list under "## Start"',n
    ph=[(i,re.sub(r'^(Phase [A-Z]:|Step \d+[.,:]?|\d+\.)\s*','',t)) for i,t in H if re.match(r'^(Phase [A-Z]:|Step \d+|\d+\.)',t)]
    if len(ph)>=2:return 'Phase/Step headings',ph
    for i,t in H:
        if re.match(r'^(steps|workflow|flow|pass)$',t,re.I):
            n=numbered(L,i,ends[i])
            if n:return f'numbered list under "## {t}"',n
    hs=[(i,t) for i,t in H if not META.match(t)]
    if len(hs)>=2:return 'section headings (no explicit ordered list)',hs
    n=numbered(L,0,len(L))
    if n:return 'top-level numbered list',n
    return 'no ordered steps in the file',[]
def inputs(L,self_):
    out=[];seen=set()
    def add(kind,name,i):
        if (kind,name) in seen:return
        seen.add((kind,name));out.append({'kind':kind,'name':name,'line':i+1})
    for i,l in enumerate(L):
        if l.startswith('---') or l.startswith('name:') or l.startswith('description:'):continue
        for m in re.finditer(r'((?:references|scripts|assets)/[\w./-]+\.\w+)',l):add('file',m.group(1),i)
        for m in re.finditer(r'`([\w.-]+\.mdc)`',l):add('rule',m.group(1),i)
        for m in re.finditer(r'\*\*([a-z][\w-]*)\*\*|`([a-z][\w-]*)`',l):
            n=m.group(1) or m.group(2)
            for c in (n,'principle-'+n):
                if c in NAMES and c!=self_:add('principle' if c.startswith('principle-') else 'skill',c,i);break
    return out
flows={}
for n in NAMES:
    if n.startswith('principle-'):continue
    p=os.path.join(SK,n,'SKILL.md');L=open(p,encoding='utf-8').read().split('\n')
    src,st=steps(L)
    flows[n]={'file':f'skills/{n}/SKILL.md','stepSource':src,'steps':[{'n':k+1,'caption':short(t),'line':i+1} for k,(i,t) in enumerate(st)],'inputs':inputs(L,n)}
PB={};pd=os.path.join(SK,'poteto-mode','playbooks')
for f in sorted(os.listdir(pd)):
    L=open(os.path.join(pd,f),encoding='utf-8').read().split('\n');chain=[]
    for i,t in numbered(L,0,len(L)):
        hit=None
        for m in re.finditer(r'`([a-z][\w-]*)`|\*\*([a-z][\w-]*)\*\*',t):
            c=m.group(1) or m.group(2)
            if c in flows:hit=c;break
        chain.append({'line':i+1,'text':short(t),'skill':hit})
    PB[f[:-3]]={'file':f'skills/poteto-mode/playbooks/{f}','steps':chain}

# FORGE-RUN.md (if present): the real order of events for PR #13. Only timeline rows and the "were not spawned" note are read.
FR=os.path.join(os.path.dirname(os.path.abspath(__file__)),'FORGE-RUN.md');forge=None
if os.path.isfile(FR):
    T=open(FR,encoding='utf-8').read();ev=[];ran=[];notrun=[]
    sec=T.split('## Timeline',1)[1].split('\n## ',1)[0] if '## Timeline' in T else ''
    for l in sec.split('\n'):
        c=[x.strip() for x in l.strip().strip('|').split('|')]
        if len(c)<3 or c[0] in('Time','---') or set(c[0])<=set('-'):continue
        txt=re.sub(r'[*`]','',c[2]);sk=sorted([n for n in flows if re.search(r'(?<![\w-])'+re.escape(n)+r'(?![\w-])',c[2])],key=lambda n:c[2].find(n))
        e={'time':c[0],'line':c[1],'text':txt,'skills':sk}
        if re.search(r'spawned',c[2]) and sk:e['ran']=sk;ran.append(sk)
        ev.append(e)

    sub=[];sa=T.split('## Subagents',1)[1].split('\n## ',1)[0] if '## Subagents' in T else ''
    for l in sa.split('\n'):
        c=[x.strip() for x in l.strip().strip('|').split('|')]
        if len(c)<5 or not c[0].isdigit():continue
        ty=re.sub(r'[*`]','',c[1]);sk=[n for n in flows if re.search(r'(?<![\w-])'+re.escape(n)+r'(?![\w-])',ty)]
        role='sicko' if 'Comment Sicko' in ty else 'delegate' if 'poteto-agent' in ty else ('guest' if sk else 'other')
        m=re.search(r'\(([^)]*)\)',ty);sub.append({'line':c[0],'type':ty,'name':(m.group(1) if m else ty),'model':c[2],'job':re.sub(r'[*`]','',c[3]),'result':re.sub(r'[*`]','',c[4]),'skill':sk[0] if sk else None,'role':role})
    rw=[];r=T.split('## Reviews and rework loops',1)[1].split('\n## ',1)[0] if '## Reviews and rework loops' in T else ''
    for l in r.split('\n'):
        m=re.match(r'\d+\.\s+(.*)',l.strip())
        if m:rw.append(re.sub(r'[*`]','',m.group(1)))
    hs=[];
    for e in ev:
        if 'poteto-agent finishes' in e['text']:hs=re.findall(r'\b[0-9a-f]{7}\b',e['text'])
    m=re.search(r'No (.+?) Tasks were spawned',T)
    if m:notrun=[n for n in re.findall(r'`([\w-]+)`',m.group(1))]
    pb=re.search(r'Playbook: \*\*(\w+)\*\*',T)
    forge={'file':'FORGE-RUN.md','playbook':(pb.group(1).lower() if pb else None),'ranInOrder':ran,'readNotRun':notrun,'events':ev,'subagents':sub,'reviews':rw,'delegateCommits':hs}
json.dump({'source':'cursor/plugins/pstack','generatedBy':'mkflows.py','skills':flows,'playbooks':PB,'forgeRun':forge},open(OUT,'w',encoding='utf-8'),indent=1,ensure_ascii=False)
print('forgeRun:',forge and {k:forge[k] for k in('playbook','ranInOrder','readNotRun')},forge and len(forge['events']))
for n,f in flows.items():print(f"{n:28s}{len(f['steps']):3d} steps {len(f['inputs']):3d} inputs  [{f['stepSource']}]")
