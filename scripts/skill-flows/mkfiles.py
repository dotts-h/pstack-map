import json,os,sys
if len(sys.argv)!=4:sys.exit('usage: mkfiles.py <plugins clone root> <graph.json> <out.json>')
ROOT,GRAPH,OUT=sys.argv[1:]
nodes=[n for n in json.load(open(GRAPH,encoding='utf-8'))['nodes'] if n['kind'] in('skill','playbook') and n.get('path')]
files={};missing=[];differ=[]
for n in nodes:
    f=os.path.join(ROOT,n['path'])
    if not os.path.isfile(f):missing.append(n['path']);continue
    with open(f,encoding='utf-8',newline='') as h:files[n['path']]=h.read()
    if files[n['path']]!=n.get('text'):differ.append(n['path'])
if differ:sys.exit('found text differs from graph node text: '+', '.join(sorted(differ)))
with open(OUT,'w',encoding='utf-8',newline='') as h:
    json.dump({'source':'cursor/plugins','files':files,'missing':sorted(missing)},h,indent=1,ensure_ascii=False,sort_keys=True);h.write('\n')
print(f'{len(files)} files, {len(missing)} missing',*missing)
