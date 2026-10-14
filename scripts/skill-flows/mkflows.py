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
def _base(v):
    return v[:-2] if re.search(r'(sh|ch|x|ss)es$',v) else v[:-1]
def question(c):
    c=re.sub(r'\s+',' ',re.sub(r'[*`]','',c)).strip().rstrip('.,;:')
    lc=c[0].lower()+c[1:] if not re.match(r'^[A-Z]{2}|^[A-Z][a-z]+[A-Z]',c) else c
    m=re.match(r'^((?:(?:the|this|your|a|an) [\w\'-]+|[\w\'-]+)(?: [\w\'-]+){0,6}?) (is|are|has|have|can|must|should|will) (.+)$',lc)
    if m and m.group(1).lower() not in('it','there'):q=f"{m.group(2).capitalize()} {m.group(1)} {m.group(3)}"
    elif re.match(r'^(it|there) (is|are) ',lc):w=lc.split(' ',2);q=f"{w[1].capitalize()} {w[0]} {w[2]}"
    elif re.match(r'^(you|we) ',lc):q='Do '+lc
    elif re.match(r'^on ',lc):q='Are you '+lc
    else:
        m=re.match(r"^((?:(?:the|this|your|a|an) [\w'-]+|[\w'-]+)(?: [\w'-]+){0,6}?) (doesn't|does not) (.+)$",lc)
        m2=re.match(r"^((?:(?:the|this|your|a|an) [\w'-]+|[\w'-]+)(?: [\w'-]+){0,6}?) (?:(\w+ly) )?([a-z]+[^us']s)( .+)?$",lc);m3=re.match(r"^((?:the|these|those) [\w'-]+s) ([a-z]+) (.+)$",lc)
        if m:q=f"Does {m.group(1)} fail to {m.group(3)}"
        elif m3:q=f"Do {m3.group(1)} {m3.group(2)} {m3.group(3)}"
        elif m2:q=f"Does {m2.group(1)} {(m2.group(2)+' ') if m2.group(2) else ''}{_base(m2.group(3))}{m2.group(4) or ''}"
        else:q=c[0].upper()+c[1:]
    q=q[0].upper()+q[1:];q=q if len(q)<=80 else q[:77].rsplit(' ',1)[0]+'…'
    return q+'?'
def ranges(L,src,st):
    H=h2(L);ends={i:(H[k+1][0] if k+1<len(H) else len(L)) for k,(i,_) in enumerate(H)}
    if not st:return []
    if src.startswith('Phase/Step') or src.startswith('section headings'):return [(i,ends[i]) for i,_ in st]
    if 'under "## Start"' in src:
        ph=[(i,t) for i,t in H if re.match(r'^(Phase [A-Z]:|Step \d+|\d+\.)',t)]
        if len(ph)==len(st):return [(i,ends[i]) for i,_ in ph]
    out=[]
    for k,(i,_) in enumerate(st):
        nxt=st[k+1][0] if k+1<len(st) else next((j for j,_ in H if j>i),len(L))
        out.append((i,nxt))
    return out
def branches(L,src,st,steps_out):
    R=ranges(L,src,st);D=[];only=None;only_cond=None
    def stamp(d):
        d['default']='yes' if d['kind']=='only' else 'no';D.append(d);return d
    for k,(a,b) in enumerate(R):
        head=L[a]
        m=re.search(r'\(([a-z -]+) only\)',head)
        if m:
            if only and only_cond==m.group(1) and only['skip'][-1]==k-1:only['skip'].append(k)
            else:only_cond=m.group(1);only=stamp({'ask':k,'kind':'only','q':f"Is the task {only_cond}?",'skip':[k],'skipOn':'no','line':a+1,'text':head.strip('# ').strip()})
        if re.search(r'\((opt-in|optional)\)',head):
            opt=None
            for j in range(a+1,b):
                mm=re.search(r'\bOpt in\b[^.]*?\bwhen ([^.:]+)',L[j])
                if mm:opt=(j,mm.group(1));break
            dflt=next((L[j] for j in range(a+1,b) if L[j].startswith('Default:')),None)
            stamp({'ask':k,'kind':'opt-in','q':question(opt[1]) if opt else f"Opt in to {steps_out[k]['caption']}?",'yes':'surface it and pause for sign-off' if opt else steps_out[k]['caption'],'no':(re.sub(r'^Default:\s*','',dflt).split('.')[0] if dflt else 'skip it'),'skip':[k],'skipOn':'no','line':(opt[0] if opt else a)+1,'text':(L[opt[0]] if opt else head).strip()})
        for j in range(a,b):
            l=L[j]
            for mm in re.finditer(r'\bSkip (Phase ([A-Z])|step (\d+)|this step)\b[^.]*?\b(?:only )?(?:when|if) ([^.]+)\.',l):
                t=(ord(mm.group(2))-65) if mm.group(2) else (int(mm.group(3))-1 if mm.group(3) else k)
                if 0<=t<len(R):stamp({'ask':t,'kind':'skip','q':question(mm.group(4)),'skip':[t],'skipOn':'yes','line':j+1,'text':mm.group(0)})
            mm=re.match(r'^\s*(?:[-*]|\d+\.)?\s*(?:\*\*)?(If|When) ([^,]{3,110}),\s*(.+)$',l)
            if mm and not re.match(r'in doubt',mm.group(2)):
                act=re.split(r'(?<=[.;])\s',re.sub(r'[*`]','',mm.group(3)))[0].rstrip('.;')
                stamp({'ask':k,'kind':mm.group(1).lower(),'q':question(mm.group(2)),'yes':act[:90],'no':'carry on','skip':[],'line':j+1,'text':l.strip()})
    D.sort(key=lambda d:(d['ask'],d['line']));return D
flows={}
for n in NAMES:
    if n.startswith('principle-'):continue
    p=os.path.join(SK,n,'SKILL.md');L=open(p,encoding='utf-8').read().split('\n')
    src,st=steps(L)
    so=[{'n':k+1,'caption':short(t),'line':i+1} for k,(i,t) in enumerate(st)]
    flows[n]={'file':f'skills/{n}/SKILL.md','stepSource':src,'steps':so,'inputs':inputs(L,n),'branches':branches(L,src,st,so)}
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
for n,f in flows.items():print(f"{n:28s}{len(f['steps']):3d} steps {len(f['inputs']):3d} inputs {len(f['branches']):2d} branches  [{f['stepSource']}]")
