/* Sales Desk v2 - project-based sales CRM, localStorage only */
const LS_PROJECTS = 'salesdesk_projects_v2';
const LS_ACTIVE = 'salesdesk_active_project_v2';
const LS_SCHEMA = 'salesdesk_schema_version_v6';
const DATA_VERSION = 6;
const TERMINAL = ['customer','rejected','closed'];
const PIPELINE_STATUSES = ['not-called','called','follow-up','interested'];
const PIPELINE_WEIGHTS = {'not-called':0.10,'called':0.25,'follow-up':0.50,'interested':0.75};

const STATUS_LABELS = {
  'not-called':'تماس گرفته نشده','called':'تماس گرفته شده','follow-up':'پیگیری',
  'interested':'علاقه‌مند','customer':'فروش موفق','rejected':'رد شده','closed':'بسته شده'
};

let projects = [];
let activeProjectId = null;
let selectedCategoryId = 'all';
let currentView = {type:'', id:''};
let currentLeadDetailId = '';
let currentLeadDetailSource = 'active';
let pendingLeadImport = null;
let followupFilter = 'all';

const $ = id => document.getElementById(id);
const genId = () => 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
const dateKey = d => { const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const todayStr = () => dateKey(new Date());
const escapeHtml = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fa-IR') : '—';
const isDateKey = d => { const value=String(d||''); if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false; const dt=new Date(`${value}T00:00:00`); return !Number.isNaN(dt.getTime())&&dateKey(dt)===value; };
const safeExternalUrl = value => { const raw=String(value||'').trim(); if(!raw)return ''; const candidate=/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)?raw:`https://${raw}`; try { const url=new URL(candidate); return ['http:','https:'].includes(url.protocol)?url.href:''; } catch { return ''; } };
const normalizeDigits = value => String(value ?? '').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const normalizeMoney = value => { const raw=normalizeDigits(value).replace(/[٬,\s_]/g,'').trim(); if(!raw)return 0; const n=Number(raw); return Number.isFinite(n)&&n>=0?Math.round(n):0; };
const formatMoney = value => { const n=normalizeMoney(value); return n?new Intl.NumberFormat('fa-IR').format(n):'—'; };

function defaultCategories(){
  return [
    {id:genId(), name:'تماس سرد', parentId:''},
    {id:genId(), name:'شروع مکالمه', parentId:''},
    {id:genId(), name:'اعتراضات', parentId:''},
    {id:genId(), name:'پیگیری', parentId:''},
    {id:genId(), name:'بستن فروش', parentId:''},
  ];
}
function makeProject(name, description=''){
  return {id:genId(), name, description, createdAt:todayStr(), leads:[], archive:[], callLog:[], tasks:[], notes:[], scripts:[], categories:defaultCategories()};
}
function activeProject(){ return projects.find(p=>p.id===activeProjectId); }
function saveProjects(){ localStorage.setItem(LS_PROJECTS, JSON.stringify(projects)); localStorage.setItem(LS_SCHEMA,String(DATA_VERSION)); }
function downloadJson(filename,data){ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
function normalizeCallLogEntry(entry){
  if(!entry||typeof entry!=='object'||typeof entry.id!=='string')return null;
  return {...entry,id:String(entry.id),leadId:String(entry.leadId||''),date:isDateKey(entry.date)?String(entry.date):'',outcome:String(entry.outcome||''),newStatus:STATUS_LABELS[entry.newStatus]?entry.newStatus:'',note:String(entry.note||'')};
}
function normalizeFollowupHistoryEntry(entry){
  if(!entry||typeof entry!=='object')return null;
  const scheduledDate=isDateKey(entry.scheduledDate)?String(entry.scheduledDate):'';
  const completedAt=isDateKey(entry.completedAt)?String(entry.completedAt):'';
  if(!scheduledDate&&!completedAt)return null;
  return {...entry,id:typeof entry.id==='string'?entry.id:genId(),scheduledDate,completedAt};
}
function normalizeLead(l){
  if(!l||typeof l!=='object'||l.id===undefined||l.id===null||l.id===''||!String(l.businessName||'').trim())return null;
  const status=STATUS_LABELS[l.status]?l.status:'not-called';
  const nextFollowupDate=isDateKey(l.nextFollowupDate)?String(l.nextFollowupDate):'';
  const lastCallDate=isDateKey(l.lastCallDate)?String(l.lastCallDate):'';
  const createdAt=isDateKey(l.createdAt)?String(l.createdAt):'';
  return {...l, id:String(l.id), businessName:String(l.businessName||'').trim(), contactName:String(l.contactName||''), industry:String(l.industry||''), phone:String(l.phone||''), website:String(l.website||''), notes:String(l.notes||''), status, nextFollowupDate, lastCallDate, createdAt, lastCallOutcome:String(l.lastCallOutcome||''), dealValue:normalizeMoney(l.dealValue), followupHistory:Array.isArray(l.followupHistory)?l.followupHistory.map(normalizeFollowupHistoryEntry).filter(Boolean):[]};
}
function normalizeProject(p){
  const base=makeProject(String(p?.name||'پروژه بدون نام'),String(p?.description||''));
  base.id=String(p?.id||base.id); base.createdAt=p?.createdAt||base.createdAt;
  base.leads=Array.isArray(p?.leads)?p.leads.map(normalizeLead).filter(Boolean):[];
  const existingArchive=Array.isArray(p?.archive)?p.archive.map(l=>{
    const normalized=normalizeLead(l); if(!normalized)return null;
    const reason=TERMINAL.includes(l?.archiveReason)?l.archiveReason:(TERMINAL.includes(normalized.status)?normalized.status:'closed');
    const archivedAt=isDateKey(l?.archivedAt)?String(l.archivedAt):todayStr();
    return {...normalized,status:reason,archiveReason:reason,archivedAt};
  }).filter(Boolean):[];
  base.archive=existingArchive;
  base.callLog=Array.isArray(p?.callLog)?p.callLog.map(normalizeCallLogEntry).filter(Boolean):[];
  base.tasks=Array.isArray(p?.tasks)?p.tasks:[]; base.notes=Array.isArray(p?.notes)?p.notes:[]; base.scripts=Array.isArray(p?.scripts)?p.scripts:[];
  const rawCategories=Array.isArray(p?.categories)?p.categories:[];
  const categoryIds=new Set(rawCategories.filter(c=>c&&typeof c.id==='string').map(c=>c.id));
  base.categories=rawCategories.length?rawCategories.filter(c=>c&&typeof c.id==='string'&&String(c.name||'').trim()).map(c=>({id:c.id,name:String(c.name).trim(),parentId:(c.parentId&&c.parentId!==c.id&&categoryIds.has(c.parentId))?c.parentId:''})):base.categories;
  const terminalLeads=base.leads.filter(l=>TERMINAL.includes(l.status)).map(l=>({...l,archiveReason:l.status,archivedAt:isDateKey(l.archivedAt)?l.archivedAt:todayStr()}));
  const mergedArchive=[...terminalLeads,...base.archive]; const seenArchiveIds=new Set();
  base.archive=mergedArchive.filter(l=>!seenArchiveIds.has(l.id)&&seenArchiveIds.add(l.id));
  base.leads=base.leads.filter(l=>!TERMINAL.includes(l.status));
  return base;
}
function isValidBackup(data){ return data && typeof data==='object' && [2,3,4,5,6].includes(Number(data.version)) && Array.isArray(data.projects) && data.projects.length<=100 && data.projects.every(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Array.isArray(p.leads)&&Array.isArray(p.archive)&&Array.isArray(p.callLog)&&Array.isArray(p.tasks)&&Array.isArray(p.notes)&&Array.isArray(p.scripts)&&Array.isArray(p.categories)); }
function openBackupModal(){ $('backupStatus').textContent=''; $('backupFile').value=''; openModal('backupModal'); }
function exportBackup(){ const payload={version:DATA_VERSION,exportedAt:new Date().toISOString(),activeProjectId,projects}; downloadJson(`sales-desk-backup-${todayStr()}.json`,payload); $('backupStatus').textContent='نسخه پشتیبان با موفقیت دانلود شد.'; }
function importBackup(file){ if(!file)return; const reader=new FileReader(); reader.onload=()=>{ try { const data=JSON.parse(reader.result); if(!isValidBackup(data)) throw new Error('invalid'); if(!confirm(`این فایل شامل ${data.projects.length} پروژه است. اطلاعات فعلی جایگزین شود؟`)) return; projects=data.projects.map(normalizeProject); activeProjectId=projects.some(p=>p.id===data.activeProjectId)?data.activeProjectId:projects[0]?.id||null; saveProjects(); localStorage.setItem(LS_ACTIVE,activeProjectId||''); $('backupStatus').textContent='بازیابی انجام شد. برنامه در حال بارگذاری مجدد است…'; setTimeout(()=>location.reload(),250); } catch { $('backupStatus').textContent='فایل پشتیبان معتبر نیست یا ساختار آن قابل شناسایی نیست.'; } }; reader.readAsText(file); }
const CSV_HEADER_ALIASES={
  businessName:['businessname','business','company','companyname','نامکسبوکار','شرکت','نامشرکت'],
  contactName:['contactname','contact','person','ناممخاطب','مخاطب'],
  industry:['industry','category','صنعت'],
  phone:['phone','mobile','telephone','شمارهتلفن','تلفن','موبایل'],
  website:['website','site','url','instagram','وبسایت','سایت','اینستاگرام','لینک'],
  notes:['notes','note','یادداشت','توضیحات'],
  status:['status','stage','وضعیت','مرحله'],
  nextFollowupDate:['nextfollowupdate','followupdate','followup','date','تاریخپیگیری','پیگیری'],
  dealValue:['dealvalue','value','amount','dealamount','ارزشمعامله','ارزش','مبلغ']
};
const IMPORT_STATUS_ALIASES={'not-called':['not-called','new','تماسگرفته‌نشده','تماسگرفته‌نشده','تماس گرفته نشده'],'called':['called','contacted','تماسگرفتهشده','تماس گرفته شده'],'follow-up':['follow-up','followup','پیگیری'],'interested':['interested','hot','علاقهمند','علاقه‌مند'],'customer':['customer','won','closed-won','فروشموفق','فروش موفق'],'rejected':['rejected','lost','ردشده','رد شده'],'closed':['closed','بستهشده','بسته شده']};
function normalizeHeader(v){return String(v||'').trim().toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\s_\-\/\\\u200c\u200b]+/g,'').replace(/[‌ًٌٍَُِّْ]/g,'');}
function detectCsvDelimiter(line){let comma=0,semi=0,quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted){if(ch===',')comma++;if(ch===';')semi++;}}return semi>comma?';':',';}
function parseCsvLine(line,delimiter){const out=[];let cell='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===delimiter&&!quoted){out.push(cell.trim());cell='';}else cell+=ch;}out.push(cell.trim());return out;}
function parseCsv(text){
  const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim()!=='');
  if(lines.length<2)throw new Error('CSV must contain a header and at least one data row.');
  const delimiter=detectCsvDelimiter(lines[0]);
  const headers=parseCsvLine(lines[0],delimiter).map(normalizeHeader);
  const indexMap={}; Object.entries(CSV_HEADER_ALIASES).forEach(([key,aliases])=>{const i=headers.findIndex(h=>aliases.map(normalizeHeader).includes(h));if(i>=0)indexMap[key]=i;});
  if(indexMap.businessName===undefined||indexMap.phone===undefined)throw new Error('CSV must include businessName/company and phone columns.');
  return lines.slice(1).map((line,rowIndex)=>{const cells=parseCsvLine(line,delimiter),get=k=>indexMap[k]===undefined?'':String(cells[indexMap[k]]??'').trim();const rawStatus=normalizeHeader(get('status'));const status=Object.entries(IMPORT_STATUS_ALIASES).find(([,values])=>values.map(normalizeHeader).includes(rawStatus))?.[0]||'not-called';return {rowNumber:rowIndex+2,businessName:get('businessName'),contactName:get('contactName'),industry:get('industry'),phone:get('phone'),website:get('website'),notes:get('notes'),status,nextFollowupDate:get('nextFollowupDate'),dealValue:normalizeMoney(get('dealValue'))};}).filter(row=>row.businessName||row.phone||row.contactName);
}
function normalizePhone(v){return normalizeDigits(v).replace(/[^0-9+]/g,'').replace(/^00/,'+');}
function importLeadKey(row){const phone=normalizePhone(row.phone);return phone?`phone:${phone}`:`lead:${row.businessName.toLowerCase()}|${row.contactName.toLowerCase()}`;}
function openLeadImportModal(){pendingLeadImport=null;$('leadImportFile').value='';$('leadImportPreview').innerHTML='<div class=\"empty-state\">یک فایل CSV انتخاب کنید.</div>';$('leadImportStatus').textContent='';$('leadImportCommitBtn').disabled=true;openModal('leadImportModal');}
function handleLeadImportFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const rows=parseCsv(reader.result);const valid=rows.filter(r=>r.businessName&&r.phone);pendingLeadImport={rows:valid,invalid:rows.length-valid.length};$('leadImportStatus').textContent=`${valid.length} لید آماده ورود است${pendingLeadImport.invalid?` و ${pendingLeadImport.invalid} ردیف به‌دلیل نبود نام یا تلفن کنار گذاشته می‌شود.`:''}`;$('leadImportPreview').innerHTML=valid.length?`<div class=\"import-summary\">${valid.slice(0,8).map(r=>`<div><strong>${escapeHtml(r.businessName)}</strong><span>${escapeHtml(r.phone)}</span><small>${STATUS_LABELS[r.status]}${r.dealValue?` · ${formatMoney(r.dealValue)}`:''}</small></div>`).join('')}</div>${valid.length>8?`<p class=\"muted-note\">فقط ۸ ردیف اول نمایش داده شده؛ کل ${valid.length} ردیف وارد خواهد شد.</p>`:''}`:'<div class=\"empty-state\">هیچ ردیف معتبری پیدا نشد.</div>';$('leadImportCommitBtn').disabled=!valid.length;}catch(err){pendingLeadImport=null;$('leadImportCommitBtn').disabled=true;$('leadImportStatus').textContent=err.message||'فایل CSV قابل پردازش نیست.';$('leadImportPreview').innerHTML='<div class=\"empty-state\">ساختار فایل را بررسی کنید.</div>';}};reader.readAsText(file);}
function commitLeadImport(){const p=activeProject();if(!p||!pendingLeadImport?.rows?.length)return;const existingKeys=new Set([...p.leads,...p.archive].map(importLeadKey));const seen=new Set();let added=0,skipped=0;pendingLeadImport.rows.forEach(row=>{const key=importLeadKey(row);if(seen.has(key)||existingKeys.has(key)){skipped++;return;}seen.add(key);const lead={id:genId(),businessName:row.businessName.trim(),contactName:row.contactName.trim(),industry:row.industry.trim(),phone:row.phone.trim(),website:row.website.trim(),notes:row.notes.trim(),status:row.status,lastCallDate:'',nextFollowupDate:isDateKey(row.nextFollowupDate)?row.nextFollowupDate:'',lastCallOutcome:'',dealValue:normalizeMoney(row.dealValue),createdAt:todayStr()};if(TERMINAL.includes(row.status))p.archive.unshift({...lead,archiveReason:row.status,archivedAt:todayStr()});else p.leads.push(lead);added++;});saveProjects();$('leadImportStatus').textContent=`ورود تمام شد: ${added} لید اضافه شد و ${skipped} مورد تکراری نادیده گرفته شد.`;pendingLeadImport=null;$('leadImportCommitBtn').disabled=true;renderAll();setTimeout(()=>closeModal('leadImportModal'),700);}
function loadProjects(){
  try { projects = JSON.parse(localStorage.getItem(LS_PROJECTS)) || []; } catch { projects=[]; }
  if (!projects.length) {
    let oldLeads=[], oldLog=[];
    try { oldLeads=JSON.parse(localStorage.getItem('stc_leads'))||[]; } catch {}
    try { oldLog=JSON.parse(localStorage.getItem('stc_callLog'))||[]; } catch {}
    if(oldLeads.length || oldLog.length){
      const p=makeProject('پروژه اول','پروژه مهاجرت‌داده‌شده از نسخه قبلی');
      p.leads=oldLeads.filter(l=>!TERMINAL.includes(l.status));
      p.archive=oldLeads.filter(l=>TERMINAL.includes(l.status)).map(l=>({...l, archivedAt:l.updatedAt||todayStr()}));
      p.callLog=oldLog; projects=[p];
    }
  }
  projects=projects.map(normalizeProject);
  saveProjects();
  activeProjectId=localStorage.getItem(LS_ACTIVE);
  if(!projects.some(p=>p.id===activeProjectId)) activeProjectId=null;
}

function init(){
  loadProjects();
  bindGlobal();
  renderGate();
  if(activeProjectId) openProject(activeProjectId);
}
function bindGlobal(){
  $('newProjectGate').onclick=()=>openProjectModal();
  $('switchProjectBtn').onclick=()=>{ $('app').classList.add('hidden'); $('projectGate').classList.remove('hidden'); renderGate(); };
  $('backupBtn').onclick=openBackupModal;
  $('followupAddLead').onclick=()=>openLeadModal();
  $('followupSearchInput').oninput=renderFollowups;
  $('followupFilter').onchange=()=>{followupFilter=$('followupFilter').value;renderFollowups();};
  $('exportBackupBtn').onclick=exportBackup;
  $('backupFile').onchange=e=>importBackup(e.target.files[0]);
  document.querySelectorAll('.nav-tab').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  document.querySelectorAll('[data-view-link]').forEach(b=>b.onclick=()=>showView(b.dataset.viewLink));
  $('dashboardAddLead').onclick=()=>openLeadModal();
  $('pipelineAddLead').onclick=()=>openLeadModal();
  $('importLeadsBtn').onclick=openLeadImportModal;
  $('exportLeadsBtn').onclick=exportLeadsCsv;
  $('leadImportFile').onchange=e=>handleLeadImportFile(e.target.files[0]);
  $('leadImportCommitBtn').onclick=commitLeadImport;
  $('addLeadBtn').onclick=()=>openLeadModal();
  $('pipelineSearchInput').oninput=renderPipeline;
  $('pipelineStatusFilter').onchange=renderPipeline;
  $('searchInput').oninput=renderLeads; $('filterStatus').onchange=renderLeads;
  $('leadsTableBody').onclick=handleLeadAction; $('leadsTableBody').onchange=handleLeadChange;
  $('followupTableBody').onclick=handleFollowupAction;
  $('leadForm').onsubmit=saveLead; $('leadCancelBtn').onclick=()=>closeModal('leadModal');
  $('callForm').onsubmit=saveCall; $('callCancelBtn').onclick=()=>closeModal('callModal');
  $('taskForm').onsubmit=addTask;
  $('newNoteBtn').onclick=()=>openNoteModal();
  $('noteForm').onsubmit=saveNote; $('noteCancelBtn').onclick=()=>closeModal('noteModal');
  $('notesGrid').onclick=handleNoteAction;
  $('newScriptBtn').onclick=()=>openScriptModal();
  $('scriptForm').onsubmit=saveScript; $('scriptCancelBtn').onclick=()=>closeModal('scriptModal');
  $('newCategoryBtn').onclick=()=>openCategoryModal();
  $('categoryForm').onsubmit=saveCategory; $('categoryCancelBtn').onclick=()=>closeModal('categoryModal');
  $('categoryTree').onclick=e=>{const b=e.target.closest('[data-cat]');if(b){selectedCategoryId=b.dataset.cat;renderScripts();}};
  $('scriptsGrid').onclick=handleScriptAction;
  $('projectForm').onsubmit=createProject; $('projectCancelBtn').onclick=()=>closeModal('projectModal');
  $('viewEditBtn').onclick=editFromView; $('viewCloseBtn').onclick=()=>closeModal('viewModal');
  $('leadDetailCallBtn').onclick=()=>handleLeadDetailAction('call'); $('leadDetailEditBtn').onclick=()=>handleLeadDetailAction('edit'); $('leadDetailRestoreBtn').onclick=()=>handleLeadDetailAction('restore');
  document.querySelectorAll('.modal-overlay').forEach(m=>m.onclick=e=>{if(e.target===m)m.classList.add('hidden')});
}

function renderGate(){
  const wrap=$('projectCards');
  wrap.innerHTML=projects.length ? projects.map(p=>`
    <button class="project-card" data-project="${p.id}">
      <span class="project-icon">▦</span><span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.description||'بدون توضیح')}</small></span>
      <b>›</b>
    </button>`).join('') : '<div class="empty-state">هنوز پروژه‌ای ساخته نشده.</div>';
  wrap.querySelectorAll('[data-project]').forEach(b=>b.onclick=()=>openProject(b.dataset.project));
}
function openProject(id){
  activeProjectId=id; localStorage.setItem(LS_ACTIVE,id);
  selectedCategoryId='all';
  $('searchInput').value='';$('filterStatus').value='';$('pipelineSearchInput').value='';$('pipelineStatusFilter').value='';followupFilter='all';$('followupSearchInput').value='';$('followupFilter').value='all';
  const p=activeProject(); if(!p)return;
  $('currentProjectName').textContent=p.name;
  $('projectGate').classList.add('hidden'); $('app').classList.remove('hidden');
  showView('dashboard'); renderAll();
}
function openProjectModal(){ $('projectForm').reset(); openModal('projectModal'); $('projectName').focus(); }
function createProject(e){
  e.preventDefault();
  const p=makeProject($('projectName').value.trim(),$('projectDescription').value.trim());
  projects.push(p); saveProjects(); closeModal('projectModal'); openProject(p.id);
}
function showView(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
  document.querySelectorAll('.nav-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('view-'+view).classList.add('active-view');
  if(view==='dashboard')renderDashboard();
  if(view==='today')renderToday();
  if(view==='leads')renderLeads();
  if(view==='pipeline')renderPipeline();
  if(view==='followups')renderFollowups();
  if(view==='archive')renderArchive();
  if(view==='tasks')renderTasks();
  if(view==='notes')renderNotes();
  if(view==='scripts')renderScripts();
}
function openModal(id){$(id).classList.remove('hidden')}
function closeModal(id){$(id).classList.add('hidden')}
function renderAll(){renderDashboard();renderToday();renderLeads();renderPipeline();renderFollowups();renderArchive();renderTasks();renderNotes();renderScripts();}

function stats(){
  const p=activeProject(), logs=p.callLog;
  const pipelineValue=p.leads.reduce((sum,l)=>sum+normalizeMoney(l.dealValue),0);
  const weightedForecast=p.leads.reduce((sum,l)=>sum+normalizeMoney(l.dealValue)*(PIPELINE_WEIGHTS[l.status]||0),0);
  const wonValue=p.archive.filter(l=>l.archiveReason==='customer').reduce((sum,l)=>sum+normalizeMoney(l.dealValue),0);
  return {
    total:p.leads.length, calls:logs.length, interested:p.leads.filter(l=>l.status==='interested').length,
    followups:p.leads.filter(l=>Boolean(l.nextFollowupDate)).length, won:p.archive.filter(l=>l.archiveReason==='customer').length,
    lost:p.archive.filter(l=>['rejected','closed'].includes(l.archiveReason)).length, pipelineValue, weightedForecast, wonValue
  };
}
function renderDashboard(){
  const p=activeProject(); if(!p)return; const s=stats();
  $('statTotal').textContent=s.total;$('statCalls').textContent=s.calls;$('statInterested').textContent=s.interested;
  $('statFollowups').textContent=s.followups;$('statWon').textContent=s.won;$('statLost').textContent=s.lost;
  $('revenuePipelineValue').textContent=formatMoney(s.pipelineValue);$('revenueWeightedValue').textContent=formatMoney(s.weightedForecast);$('revenueWonValue').textContent=formatMoney(s.wonValue);
  drawLineChart($('callsChart'), callsByDay(p,14));
  drawBarChart($('statusChart'), Object.entries(STATUS_LABELS).filter(([k])=>k!=='not-called').map(([k,v])=>({label:v,value:p.leads.filter(l=>l.status===k).length})));
  drawFunnel($('funnelChart'), [
    {label:'کل لید',value:p.leads.length+p.archive.length},
    {label:'تماس',value:p.callLog.length?new Set(p.callLog.map(x=>x.leadId)).size:0},
    {label:'علاقه‌مند',value:p.leads.filter(l=>l.status==='interested').length+p.archive.filter(l=>l.archiveReason==='customer').length},
    {label:'فروش موفق',value:s.won}
  ]);
  const upcoming=p.leads.filter(l=>l.nextFollowupDate).sort((a,b)=>a.nextFollowupDate.localeCompare(b.nextFollowupDate)).slice(0,6);
  $('upcomingFollowups').innerHTML=upcoming.length?upcoming.map(l=>`<button class="mini-item mini-item-action" data-followup-dashboard="${l.id}"><span>${escapeHtml(l.businessName)}</span><b>${fmtDate(l.nextFollowupDate)}</b></button>`).join(''):'<div class="empty-state">پیگیری برنامه‌ریزی‌شده‌ای نیست.</div>';
  $('upcomingFollowups').onclick=e=>{const item=e.target.closest('[data-followup-dashboard]');if(item){const l=p.leads.find(x=>x.id===item.dataset.followupDashboard);if(l)openCallModal(l);}};
}
function callsByDay(p,n){
  const arr=[]; for(let i=n-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=dateKey(d);arr.push({label:d.toLocaleDateString('fa-IR',{month:'numeric',day:'numeric'}),value:p.callLog.filter(x=>x.date===key).length});} return arr;
}
function prepCanvas(c){const r=c.getBoundingClientRect(),d=window.devicePixelRatio||1,w=Math.max(1,r.width),h=Math.max(220,r.height);c.width=w*d;c.height=h*d;const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);return [x,w,h]}
function drawLineChart(c,data){const [x,w,h]=prepCanvas(c);x.clearRect(0,0,w,h);const pad=30,max=Math.max(1,...data.map(d=>d.value));x.beginPath();data.forEach((d,i)=>{const px=pad+i*(w-pad*2)/Math.max(1,data.length-1),py=h-pad-(d.value/max)*(h-pad*2);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();data.forEach((d,i)=>{const px=pad+i*(w-pad*2)/Math.max(1,data.length-1),py=h-pad-(d.value/max)*(h-pad*2);x.beginPath();x.arc(px,py,3,0,Math.PI*2);x.fill();if(i%2===0){x.font='10px sans-serif';x.textAlign='center';x.fillText(d.label,px,h-8)}});x.textAlign='start'}
function drawBarChart(c,data){const [x,w,h]=prepCanvas(c);x.clearRect(0,0,w,h);const pad=28,max=Math.max(1,...data.map(d=>d.value)),bw=(w-pad*2)/Math.max(1,data.length)*.65;data.forEach((d,i)=>{const px=pad+i*(w-pad*2)/data.length+(w-pad*2)/data.length*.17, bh=(d.value/max)*(h-65);x.fillRect(px,h-35-bh,bw,bh);x.font='10px sans-serif';x.textAlign='center';x.fillText(d.label.slice(0,12),px+bw/2,h-18);x.fillText(d.value,px+bw/2,h-40-bh)});x.textAlign='start'}
function drawFunnel(c,data){const [x,w,h]=prepCanvas(c);x.clearRect(0,0,w,h);const max=Math.max(1,data[0]?.value||0);data.forEach((d,i)=>{const ww=(w-50)*(d.value/max)*(1-i*.12), yy=15+i*48,xx=(w-ww)/2;x.fillRect(xx,yy,ww,32);x.fillStyle='white';x.font='12px sans-serif';x.textAlign='center';x.fillText(`${d.label}: ${d.value}`,w/2,yy+21);x.fillStyle='black'});x.textAlign='start'}

function addDays(dateString,days){const d=new Date(`${dateString}T00:00:00`);d.setDate(d.getDate()+days);return dateKey(d);}
function followupBucket(dateString){const today=todayStr();if(dateString<today)return 'overdue';if(dateString===today)return 'today';return 'upcoming';}
function daysUntil(dateString){const a=new Date(`${todayStr()}T00:00:00`),b=new Date(`${dateString}T00:00:00`);return Math.round((b-a)/86400000);}
function followupLabel(dateString){const days=daysUntil(dateString);if(days<0)return `${Math.abs(days)} روز عقب‌افتاده`;if(days===0)return 'امروز';if(days===1)return 'فردا';return `${days} روز دیگر`;}
function getFollowupLeads(){const p=activeProject(),q=$('followupSearchInput').value.trim().toLowerCase();return p.leads.filter(l=>l.nextFollowupDate).filter(l=>followupFilter==='all'||followupBucket(l.nextFollowupDate)===followupFilter).filter(l=>!q||[l.businessName,l.contactName,l.industry,l.phone].some(v=>String(v||'').toLowerCase().includes(q))).sort((a,b)=>a.nextFollowupDate.localeCompare(b.nextFollowupDate)||a.businessName.localeCompare(b.businessName,'fa'));}
function renderFollowups(){const p=activeProject();if(!p)return;const scheduled=p.leads.filter(l=>l.nextFollowupDate);const overdue=scheduled.filter(l=>followupBucket(l.nextFollowupDate)==='overdue').length;const today=scheduled.filter(l=>followupBucket(l.nextFollowupDate)==='today').length;const upcoming=scheduled.filter(l=>followupBucket(l.nextFollowupDate)==='upcoming').length;$('followupOverdueCount').textContent=overdue;$('followupTodayCount').textContent=today;$('followupUpcomingCount').textContent=upcoming;$('followupTotalCount').textContent=scheduled.length;const rows=getFollowupLeads();$('followupWrap').classList.toggle('is-empty',!rows.length);$('followupTableBody').innerHTML=rows.map(l=>`<tr><td><strong>${fmtDate(l.nextFollowupDate)}</strong><div class="followup-due ${followupBucket(l.nextFollowupDate)}">${followupLabel(l.nextFollowupDate)}</div></td><td><strong>${escapeHtml(l.businessName)}</strong></td><td>${escapeHtml(l.contactName)||'—'}</td><td>${escapeHtml(l.phone)||'—'}</td><td><span class="badge badge-primary-soft">${STATUS_LABELS[l.status]}</span></td><td>${fmtDate(l.lastCallDate)}</td><td class="actions-cell"><button class="btn btn-sm btn-view" data-followup-action="details" data-id="${l.id}">جزئیات</button><button class="btn btn-sm btn-call" data-followup-action="call" data-id="${l.id}">تماس</button><button class="btn btn-sm btn-secondary" data-followup-action="snooze1" data-id="${l.id}">فردا</button><button class="btn btn-sm btn-edit" data-followup-action="edit" data-id="${l.id}">ویرایش</button><button class="btn btn-sm btn-restore" data-followup-action="done" data-id="${l.id}">انجام شد</button></td></tr>`).join('');}
function handleFollowupAction(e){const b=e.target.closest('[data-followup-action]');if(!b)return;const p=activeProject(),l=p.leads.find(x=>x.id===b.dataset.id);if(!l)return;const action=b.dataset.followupAction;if(action==='details'){openLeadDetail(l,'active');return;}if(action==='call'){openCallModal(l);return;}if(action==='edit'){openLeadModal(l);return;}if(action==='snooze1'){l.nextFollowupDate=addDays(todayStr(),1);}if(action==='done'){const date=todayStr();l.followupHistory=l.followupHistory||[];l.followupHistory.push({id:genId(),scheduledDate:l.nextFollowupDate,completedAt:date});l.notes=(l.notes?l.notes+'\n':'')+`[${date}] پیگیری انجام شد.`;l.nextFollowupDate='';}saveProjects();renderDashboard();renderFollowups();}

function getFilteredLeads(){const p=activeProject(),q=$('searchInput').value.trim().toLowerCase(),sf=$('filterStatus').value;return p.leads.filter(l=>(!sf||l.status===sf)&&(!q||[l.businessName,l.industry,l.phone,l.contactName].some(v=>String(v||'').toLowerCase().includes(q))))}
function renderLeads(){
  const p=activeProject(); if(!p)return;
  const currentFilter=$('filterStatus').value;
  $('filterStatus').innerHTML='<option value="">همه وضعیت‌ها</option>'+Object.entries(STATUS_LABELS).filter(([k])=>!TERMINAL.includes(k)).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
  $('filterStatus').value=Object.keys(STATUS_LABELS).includes(currentFilter)&&!TERMINAL.includes(currentFilter)?currentFilter:'';
  const rows=getFilteredLeads();$('tableWrap').classList.toggle('is-empty',!rows.length);
  $('leadsTableBody').innerHTML=rows.map(l=>`<tr><td><strong>${escapeHtml(l.businessName)}</strong></td><td>${escapeHtml(l.contactName)||'—'}</td><td>${escapeHtml(l.industry)||'—'}</td><td>${escapeHtml(l.phone)}</td><td>${formatMoney(l.dealValue)}</td><td><select class="status-select" data-id="${l.id}">${Object.entries(STATUS_LABELS).filter(([k])=>!TERMINAL.includes(k)).map(([k,v])=>`<option value="${k}" ${l.status===k?'selected':''}>${v}</option>`).join('')}</select></td><td>${fmtDate(l.nextFollowupDate)}</td><td>${fmtDate(l.lastCallDate)}</td><td class="actions-cell"><button class="btn btn-sm btn-view" data-action="details" data-id="${l.id}">جزئیات</button><button class="btn btn-sm btn-call" data-action="call" data-id="${l.id}">ثبت تماس</button><button class="btn btn-sm btn-edit" data-action="edit" data-id="${l.id}">ویرایش</button><button class="btn btn-sm btn-delete" data-action="delete" data-id="${l.id}">حذف</button></td></tr>`).join('');
}
function handleLeadChange(e){if(!e.target.classList.contains('status-select'))return;const l=activeProject().leads.find(x=>x.id===e.target.dataset.id);if(l){l.status=e.target.value;if(TERMINAL.includes(l.status))archiveLead(l,l.status);saveProjects();renderAll()}}
function pipelineMatches(l){
  const q=$('pipelineSearchInput').value.trim().toLowerCase(), sf=$('pipelineStatusFilter').value;
  return PIPELINE_STATUSES.includes(l.status)&&(!sf||l.status===sf)&&(!q||[l.businessName,l.contactName,l.industry,l.phone].some(v=>String(v||'').toLowerCase().includes(q)));
}
function renderPipeline(){
  const p=activeProject(); if(!p)return;
  const currentFilter=$('pipelineStatusFilter').value;
  $('pipelineStatusFilter').innerHTML='<option value="">همه مراحل</option>'+PIPELINE_STATUSES.map(k=>`<option value="${k}">${STATUS_LABELS[k]}</option>`).join('');
  $('pipelineStatusFilter').value=PIPELINE_STATUSES.includes(currentFilter)?currentFilter:'';
  const groups=PIPELINE_STATUSES.map(status=>{
    const leads=p.leads.filter(l=>l.status===status&&pipelineMatches(l));
    return `<section class="pipeline-column" data-drop-status="${status}">
      <header class="pipeline-column-head"><div><strong>${STATUS_LABELS[status]}</strong><span>${leads.length}</span></div></header>
      <div class="pipeline-cards">${leads.length?leads.map(l=>`<article class="pipeline-card" draggable="true" data-pipeline-id="${l.id}">
        <div class="pipeline-card-top"><strong>${escapeHtml(l.businessName)}</strong><span>${escapeHtml(l.industry||'')||'—'}</span></div>
        <div class="pipeline-contact">${escapeHtml(l.contactName||'بدون مخاطب')} · ${escapeHtml(l.phone||'بدون تلفن')}</div>
        <div class="pipeline-meta"><span>ارزش: ${formatMoney(l.dealValue)}</span><span>پیگیری: ${fmtDate(l.nextFollowupDate)}</span><span>${fmtDate(l.lastCallDate)}</span></div>
        <div class="pipeline-actions"><button class="btn btn-sm btn-view" data-pipeline-action="details" data-id="${l.id}">جزئیات</button><button class="btn btn-sm btn-call" data-pipeline-action="call" data-id="${l.id}">تماس</button><button class="btn btn-sm btn-edit" data-pipeline-action="edit" data-id="${l.id}">ویرایش</button></div>
      </article>`).join(''):`<div class="pipeline-empty">این مرحله خالی است</div>`}</div>
    </section>`;
  }).join('');
  $('pipelineBoard').innerHTML=groups;
  $('pipelineBoard').querySelectorAll('[data-pipeline-id]').forEach(card=>{
    card.addEventListener('dragstart',e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',card.dataset.pipelineId);card.classList.add('dragging');});
    card.addEventListener('dragend',()=>card.classList.remove('dragging'));
  });
  $('pipelineBoard').querySelectorAll('[data-drop-status]').forEach(col=>{
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over');});
    col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
    col.addEventListener('drop',e=>{
      e.preventDefault(); col.classList.remove('drag-over');
      const id=e.dataTransfer.getData('text/plain'), l=p.leads.find(x=>x.id===id);
      if(!l || l.status===col.dataset.dropStatus)return;
      l.status=col.dataset.dropStatus; saveProjects(); renderAll();
    });
  });
  $('pipelineBoard').onclick=e=>{
    const b=e.target.closest('[data-pipeline-action]'); if(!b)return;
    const l=p.leads.find(x=>x.id===b.dataset.id); if(!l)return;
    if(b.dataset.pipelineAction==='details')openLeadDetail(l,'active'); else if(b.dataset.pipelineAction==='call')openCallModal(l); else openLeadModal(l);
  };
}

function handleLeadAction(e){const b=e.target.closest('[data-action]');if(!b)return;const p=activeProject(),l=p.leads.find(x=>x.id===b.dataset.id);if(!l)return;if(b.dataset.action==='details')openLeadDetail(l,'active');if(b.dataset.action==='call')openCallModal(l);if(b.dataset.action==='edit')openLeadModal(l);if(b.dataset.action==='delete'&&confirm(`«${l.businessName}» حذف شود؟`)){p.leads=p.leads.filter(x=>x.id!==l.id);p.callLog=p.callLog.filter(x=>x.leadId!==l.id);saveProjects();renderAll()}}
function openLeadModal(l=null){$('leadForm').reset();$('leadId').value=l?.id||'';$('leadModalTitle').textContent=l?'ویرایش لید':'افزودن لید جدید';if(l){$('leadBusinessName').value=l.businessName||'';$('leadContactName').value=l.contactName||'';$('leadIndustry').value=l.industry||'';$('leadPhone').value=l.phone||'';$('leadWebsite').value=l.website||'';$('leadNotes').value=l.notes||'';$('leadDealValue').value=normalizeMoney(l.dealValue)||''}openModal('leadModal');$('leadBusinessName').focus()}
function findDuplicateLeadByPhone(p,phone,excludeId=''){const key=normalizePhone(phone);return key?[...p.leads,...p.archive].find(l=>l.id!==excludeId&&normalizePhone(l.phone)===key):null;}
function saveLead(e){e.preventDefault();const p=activeProject(),id=$('leadId').value,base={businessName:$('leadBusinessName').value.trim(),contactName:$('leadContactName').value.trim(),industry:$('leadIndustry').value.trim(),phone:$('leadPhone').value.trim(),website:$('leadWebsite').value.trim(),notes:$('leadNotes').value.trim(),dealValue:normalizeMoney($('leadDealValue').value)};if(!base.businessName||!base.phone)return;const duplicate=findDuplicateLeadByPhone(p,base.phone,id);if(duplicate){alert(`این شماره قبلاً برای «${duplicate.businessName}» ثبت شده است.`);return;}if(id){const existing=p.leads.find(l=>l.id===id);if(existing)Object.assign(existing,base)}else p.leads.push({id:genId(),...base,status:'not-called',lastCallDate:'',nextFollowupDate:'',lastCallOutcome:'',createdAt:todayStr()});saveProjects();closeModal('leadModal');renderAll()}

function openCallModal(l){$('callForm').reset();$('callLeadId').value=l.id;$('callLeadName').textContent=l.businessName;$('callStatus').innerHTML=Object.entries(STATUS_LABELS).filter(([k])=>!TERMINAL.includes(k)).map(([k,v])=>`<option value="${k}" ${l.status===k?'selected':''}>${v}</option>`).join('')+'<option value="customer">فروش موفق — انتقال به بایگانی</option><option value="rejected">رد شد — انتقال به بایگانی</option><option value="closed">بسته شد — انتقال به بایگانی</option>';$('callNextFollowup').value=l.nextFollowupDate||'';openModal('callModal')}
function saveCall(e){e.preventDefault();const p=activeProject(),l=p.leads.find(x=>x.id===$('callLeadId').value);if(!l)return;const status=$('callStatus').value,date=todayStr(),note=$('callNoteText').value.trim();l.status=status;l.lastCallDate=date;l.lastCallOutcome=$('callOutcome').value;l.nextFollowupDate=$('callNextFollowup').value;if(note)l.notes=(l.notes?l.notes+'\n':'')+`[${date}] ${note}`;p.callLog.push({id:genId(),leadId:l.id,date,outcome:l.lastCallOutcome,newStatus:status,note});if(TERMINAL.includes(status))archiveLead(l,status);saveProjects();closeModal('callModal');renderAll()}
function archiveLead(l,reason){const p=activeProject();const copy={...l,archiveReason:reason,archivedAt:todayStr()};p.archive.unshift(copy);p.leads=p.leads.filter(x=>x.id!==l.id);}

function renderArchive(){const p=activeProject();if(!p)return;$('archiveCount').textContent=p.archive.length;$('archiveWrap').classList.toggle('is-empty',!p.archive.length);$('archiveTableBody').innerHTML=p.archive.map(l=>`<tr><td><strong>${escapeHtml(l.businessName)}</strong></td><td>${escapeHtml(l.phone)}</td><td>${formatMoney(l.dealValue)}</td><td><span class="badge ${l.archiveReason==='customer'?'badge-success':'badge-danger'}">${STATUS_LABELS[l.archiveReason]||'بسته شده'}</span></td><td>${fmtDate(l.archivedAt)}</td><td class="note-cell">${escapeHtml((l.notes||'').split('\n').slice(-1)[0])||'—'}</td><td class="actions-cell"><button class="btn btn-sm btn-view" data-archive-action="details" data-id="${l.id}">جزئیات</button><button class="btn btn-sm btn-restore" data-restore="${l.id}">بازگردانی</button><button class="btn btn-sm btn-delete" data-archive-delete="${l.id}">حذف</button></td></tr>`).join('');$('archiveTableBody').onclick=e=>{const p=activeProject(),r=e.target.closest('[data-restore]'),d=e.target.closest('[data-archive-delete]'),v=e.target.closest('[data-archive-action="details"]');if(v){const lead=p.archive.find(x=>x.id===v.dataset.id);if(lead)openLeadDetail(lead,'archive');return;}if(r){const l=p.archive.find(x=>x.id===r.dataset.restore);if(l){l.status='follow-up';delete l.archiveReason;delete l.archivedAt;p.leads.push(l);p.archive=p.archive.filter(x=>x.id!==r.dataset.restore);saveProjects();renderAll()}}if(d&&confirm('این رکورد برای همیشه حذف شود؟')){p.archive=p.archive.filter(x=>x.id!==d.dataset.archiveDelete);saveProjects();renderArchive();renderDashboard()}}}

/* Bug fix: Lead 360 called this function but it was never defined */
function leadActivityEvents(p,l){
  const events=[];
  if(l.createdAt)events.push({type:'created',date:l.createdAt,title:'لید ثبت شد',meta:'',body:[l.industry,l.contactName].filter(Boolean).join(' · ')||'—'});
  p.callLog.filter(c=>c.leadId===l.id).forEach(c=>events.push({type:'call',date:c.date,title:'تماس ثبت شد',meta:[c.outcome==='answered'?'پاسخ داده شد':c.outcome==='no-answer'?'پاسخ داده نشد':'',STATUS_LABELS[c.newStatus]||''].filter(Boolean).join(' · '),body:c.note||'بدون یادداشت'}));
  (l.followupHistory||[]).forEach(h=>events.push({type:'followup',date:h.completedAt||h.scheduledDate,title:'پیگیری انجام شد',meta:h.scheduledDate?`موعد: ${fmtDate(h.scheduledDate)}`:'',body:'پیگیری برنامه‌ریزی‌شده تکمیل شد.'}));
  return events.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}

/* Feature: Smart Call Queue (امروز) - ranks active leads by follow-up urgency, stage and deal value */
function leadScore(l,maxValue){
  const reasons=[];let score={'interested':40,'follow-up':25,'called':10,'not-called':5}[l.status]||0;
  if(l.nextFollowupDate){const d=daysUntil(l.nextFollowupDate);if(d<0){score+=100+Math.min(30,-d);reasons.push(`${-d} روز عقب‌افتاده`);}else if(d===0){score+=80;reasons.push('پیگیری امروز');}else if(d<=2){score+=20;reasons.push('پیگیری نزدیک');}}
  if(l.status==='interested')reasons.push('علاقه‌مند');
  const v=normalizeMoney(l.dealValue);if(v>0){score+=Math.round(20*v/maxValue);reasons.push('ارزش: '+formatMoney(v));}
  if(!l.lastCallDate){score+=5;reasons.push('هنوز تماس گرفته نشده');}
  return {score,reasons};
}
function renderToday(){
  const p=activeProject();if(!p)return;
  const maxValue=Math.max(1,...p.leads.map(l=>normalizeMoney(l.dealValue)));
  const ranked=p.leads.map(l=>({l,...leadScore(l,maxValue)})).sort((a,b)=>b.score-a.score||a.l.businessName.localeCompare(b.l.businessName,'fa')).slice(0,10);
  $('todayList').innerHTML=ranked.length?ranked.map((r,i)=>`<article class="today-item"><div class="today-rank">${i+1}</div><div class="today-main"><strong>${escapeHtml(r.l.businessName)}</strong><small>${escapeHtml(r.l.contactName||'بدون مخاطب')} · ${escapeHtml(r.l.phone)}</small><div class="today-reasons">${r.reasons.map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div></div><div class="today-score"><b>${r.score}</b><small>امتیاز</small></div><div class="actions-cell"><button class="btn btn-sm btn-view" data-today-action="details" data-id="${escapeHtml(r.l.id)}">جزئیات</button><button class="btn btn-sm btn-call" data-today-action="call" data-id="${escapeHtml(r.l.id)}">تماس</button></div></article>`).join(''):'<div class="empty-state">لید فعالی برای تماس وجود ندارد.</div>';
  $('todayList').onclick=e=>{const b=e.target.closest('[data-today-action]');if(!b)return;const l=p.leads.find(x=>x.id===b.dataset.id);if(!l)return;if(b.dataset.todayAction==='details')openLeadDetail(l,'active');else openCallModal(l);};
  $('todayStartBtn').disabled=!ranked.length;
  $('todayStartBtn').onclick=()=>{if(ranked[0])openCallModal(ranked[0].l);};
}

/* Feature: CRM data export (CSV, same columns the importer understands) */
function csvCell(v){let s=String(v??'').replace(/\r?\n/g,' | ');if(/^[=@]/.test(s)||(/^[+-]/.test(s)&&!/^[+-]?[\d\s()-]+$/.test(s)))s="'"+s;return /[",;]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function exportLeadsCsv(){
  const p=activeProject();if(!p)return;
  const header=['businessName','contactName','industry','phone','website','notes','status','nextFollowupDate','dealValue','lastCallDate','callCount'];
  const rows=[...p.leads,...p.archive].map(l=>[l.businessName,l.contactName,l.industry,l.phone,l.website,l.notes,l.archiveReason||l.status,l.nextFollowupDate,normalizeMoney(l.dealValue),l.lastCallDate,p.callLog.filter(c=>c.leadId===l.id).length]);
  const csv='\uFEFF'+[header,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`sales-desk-leads-${todayStr()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function openLeadDetail(l,source='active'){
  if(!l)return;
  currentLeadDetailId=l.id; currentLeadDetailSource=source;
  const p=activeProject();
  $('leadDetailTitle').textContent=l.businessName;
  $('leadDetailSubtitle').textContent=[l.contactName,l.industry].filter(Boolean).join(' · ')||'بدون مخاطب یا صنعت';
  const statusLabel=STATUS_LABELS[l.archiveReason||l.status]||STATUS_LABELS.closed;
  const externalUrl=safeExternalUrl(l.website);
  $('leadDetailStatus').textContent=statusLabel;
  $('leadDetailStatus').className=`badge ${l.archiveReason==='customer'||l.status==='customer'?'badge-success':'badge-primary-soft'}`;
  $('leadDetailInfo').innerHTML=`<div><small>تلفن</small><strong>${escapeHtml(l.phone)||'—'}</strong></div><div><small>وبسایت</small><strong>${externalUrl?`<a href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.website)}</a>`:'—'}</strong></div><div><small>ارزش معامله</small><strong>${formatMoney(l.dealValue)}</strong></div><div><small>ایجاد</small><strong>${fmtDate(l.createdAt)}</strong></div><div><small>آخرین تماس</small><strong>${fmtDate(l.lastCallDate)}</strong></div><div><small>پیگیری بعدی</small><strong>${fmtDate(l.nextFollowupDate)}</strong></div><div><small>نتیجه آخرین تماس</small><strong>${l.lastCallOutcome==='answered'?'پاسخ داده شد':l.lastCallOutcome==='no-answer'?'پاسخ داده نشد':'—'}</strong></div>`;
  $('leadDetailNotes').textContent=l.notes||'یادداشتی برای این لید ثبت نشده است.';
  const events=leadActivityEvents(p,l);
  $('leadDetailTimeline').innerHTML=events.length?events.map(e=>`<article class="timeline-item"><span class="timeline-dot ${e.type}"></span><div class="timeline-content"><div class="timeline-top"><strong>${escapeHtml(e.title)}</strong><time>${fmtDate(e.date)}</time></div>${e.meta?`<small>${escapeHtml(e.meta)}</small>`:''}<p>${escapeHtml(e.body).replace(/\n/g,'<br>')}</p></div></article>`).join(''):'<div class="empty-state">هنوز فعالیتی برای این لید ثبت نشده است.</div>';
  $('leadDetailCallBtn').classList.toggle('hidden',source!=='active');
  $('leadDetailEditBtn').classList.toggle('hidden',source!=='active');
  $('leadDetailRestoreBtn').classList.toggle('hidden',source!=='archive');
  openModal('leadDetailModal');
}
function handleLeadDetailAction(action){
  const p=activeProject(),id=currentLeadDetailId;
  if(!p||!id)return;
  if(currentLeadDetailSource==='active'){
    const l=p.leads.find(x=>x.id===id); if(!l)return;
    if(action==='call'){closeModal('leadDetailModal');openCallModal(l);}
    if(action==='edit'){closeModal('leadDetailModal');openLeadModal(l);}
    return;
  }
  const l=p.archive.find(x=>x.id===id); if(!l)return;
  if(action==='restore'){
    l.status='follow-up'; delete l.archiveReason; delete l.archivedAt;
    p.leads.push(l); p.archive=p.archive.filter(x=>x.id!==id); saveProjects(); closeModal('leadDetailModal'); renderAll();
  }
}

function renderTasks(){const p=activeProject(),list=p.tasks;$('taskList').innerHTML=list.length?list.map(t=>`<div class="task ${t.done?'done':''}"><label><input type="checkbox" data-task-toggle="${t.id}" ${t.done?'checked':''}><span>${escapeHtml(t.title)}</span></label><div><small class="${t.priority==='high'?'priority-high':''}">${t.priority==='high'?'مهم':'عادی'}</small><button class="icon-btn" data-task-delete="${t.id}">×</button></div></div>`).join(''):'<div class="empty-state">کاری ثبت نشده.</div>';const done=list.filter(x=>x.done).length;$('taskSummary').innerHTML=`<strong>${done} / ${list.length}</strong><span>کار انجام‌شده</span><div class="progress-line"><i style="width:${list.length?done/list.length*100:0}%"></i></div>`;$('taskList').onclick=e=>{const t=p.tasks.find(x=>x.id===e.target.dataset.taskToggle);if(t){t.done=e.target.checked;saveProjects();renderTasks()}const d=e.target.closest('[data-task-delete]');if(d){p.tasks=p.tasks.filter(x=>x.id!==d.dataset.taskDelete);saveProjects();renderTasks()}}}
function addTask(e){e.preventDefault();const p=activeProject();p.tasks.push({id:genId(),title:$('taskInput').value.trim(),priority:$('taskPriority').value,done:false,createdAt:todayStr()});saveProjects();$('taskForm').reset();renderTasks()}

function renderNotes(){const p=activeProject();$('notesGrid').innerHTML=p.notes.length?p.notes.slice().reverse().map(n=>`<article class="note-card"><div class="note-top"><h3>${escapeHtml(n.title)}</h3><span>${fmtDate(n.updatedAt||n.createdAt)}</span></div><p>${escapeHtml(n.body).replace(/\n/g,'<br>')}</p><div class="note-actions"><button class="btn btn-sm btn-view" data-note-view="${n.id}">مشاهده بزرگ</button><button class="btn btn-sm btn-edit" data-note-edit="${n.id}">ویرایش</button><button class="btn btn-sm btn-delete" data-note-delete="${n.id}">حذف</button></div></article>`).join(''):'<div class="empty-state panel">دفترچه خالی است.</div>'}
function openNoteModal(n=null){$('noteForm').reset();$('noteId').value=n?.id||'';$('noteModalTitle').textContent=n?'ویرایش یادداشت':'یادداشت جدید';if(n){$('noteTitle').value=n.title;$('noteBody').value=n.body}openModal('noteModal')}
function saveNote(e){e.preventDefault();const p=activeProject(),id=$('noteId').value,base={title:$('noteTitle').value.trim(),body:$('noteBody').value.trim(),updatedAt:todayStr()};if(id)Object.assign(p.notes.find(n=>n.id===id),base);else p.notes.push({id:genId(),...base,createdAt:todayStr()});saveProjects();closeModal('noteModal');renderNotes()}
function handleNoteAction(e){const b=e.target.closest('[data-note-edit],[data-note-delete],[data-note-view]');if(!b)return;const p=activeProject(),id=b.dataset.noteEdit||b.dataset.noteDelete||b.dataset.noteView,n=p.notes.find(x=>x.id===id);if(b.dataset.noteView)openViewModal('note',n);else if(b.dataset.noteEdit)openNoteModal(n);else if(confirm('یادداشت حذف شود؟')){p.notes=p.notes.filter(x=>x.id!==id);saveProjects();renderNotes()}}

function renderCategories(){const p=activeProject();const roots=p.categories.filter(c=>!c.parentId);const child=(parent,depth=0)=>p.categories.filter(c=>c.parentId===parent).map(c=>`<button class="cat-item ${selectedCategoryId===c.id?'selected':''}" data-cat="${c.id}" style="--depth:${depth}">${depth?'↳ ':''}${escapeHtml(c.name)}</button>`).join('');$('categoryTree').innerHTML=`<button class="cat-item ${selectedCategoryId==='all'?'selected':''}" data-cat="all">همه اسکریپت‌ها</button>`+roots.map(c=>`<button class="cat-item ${selectedCategoryId===c.id?'selected':''}" data-cat="${c.id}">${escapeHtml(c.name)}</button>${child(c.id,1)}`).join('')}
function renderScripts(){const p=activeProject();renderCategories();const scripts=p.scripts.filter(s=>selectedCategoryId==='all'||s.categoryId===selectedCategoryId||s.subcategoryId===selectedCategoryId);$('scriptsGrid').innerHTML=scripts.length?scripts.map(s=>{const cat=p.categories.find(c=>c.id===s.categoryId),sub=p.categories.find(c=>c.id===s.subcategoryId);return `<article class="script-card"><div class="script-meta"><span>${escapeHtml(cat?.name||'بدون دسته')}</span>${sub?`<span>› ${escapeHtml(sub.name)}</span>`:''}</div><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.body).replace(/\n/g,'<br>')}</p><div class="script-actions"><button class="btn btn-sm btn-view" data-script-view="${s.id}">مشاهده بزرگ</button><button class="btn btn-sm btn-edit" data-script-edit="${s.id}">ویرایش</button><button class="btn btn-sm btn-delete" data-script-delete="${s.id}">حذف</button></div></article>`}).join(''):'<div class="empty-state panel">اسکریپتی در این دسته وجود ندارد.</div>'}
function populateScriptCategories(selected='',sub=''){const p=activeProject();$('scriptCategory').innerHTML=p.categories.filter(c=>!c.parentId).map(c=>`<option value="${c.id}" ${selected===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('');updateSubcategories(sub)}
function updateSubcategories(selected=''){const p=activeProject(),cat=$('scriptCategory').value;$('scriptSubcategory').innerHTML='<option value="">بدون زیر‌دسته</option>'+p.categories.filter(c=>c.parentId===cat).map(c=>`<option value="${c.id}" ${selected===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
function openScriptModal(s=null){$('scriptForm').reset();$('scriptId').value=s?.id||'';$('scriptModalTitle').textContent=s?'ویرایش اسکریپت':'اسکریپت جدید';populateScriptCategories(s?.categoryId||'');if(s){$('scriptTitle').value=s.title;$('scriptBody').value=s.body;updateSubcategories(s.subcategoryId||'')}$('scriptCategory').onchange=()=>updateSubcategories();openModal('scriptModal')}
function saveScript(e){e.preventDefault();const p=activeProject(),id=$('scriptId').value,base={title:$('scriptTitle').value.trim(),categoryId:$('scriptCategory').value,subcategoryId:$('scriptSubcategory').value,body:$('scriptBody').value.trim(),updatedAt:todayStr()};if(id)Object.assign(p.scripts.find(s=>s.id===id),base);else p.scripts.push({id:genId(),...base,createdAt:todayStr()});saveProjects();closeModal('scriptModal');renderScripts()}
function handleScriptAction(e){const b=e.target.closest('[data-script-edit],[data-script-delete],[data-script-view]');if(!b)return;const p=activeProject(),id=b.dataset.scriptEdit||b.dataset.scriptDelete||b.dataset.scriptView;if(b.dataset.scriptView)openViewModal('script',p.scripts.find(s=>s.id===id));else if(b.dataset.scriptEdit)openScriptModal(p.scripts.find(s=>s.id===id));else if(confirm('اسکریپت حذف شود؟')){p.scripts=p.scripts.filter(s=>s.id!==id);saveProjects();renderScripts()}}
function openCategoryModal(){const p=activeProject();$('categoryForm').reset();$('categoryParent').innerHTML='<option value="">بدون مادر</option>'+p.categories.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');openModal('categoryModal')}
function saveCategory(e){e.preventDefault();const p=activeProject(),name=$('categoryName').value.trim(),parentId=$('categoryParent').value;if(!name)return;if(p.categories.some(c=>c.name.trim().toLowerCase()===name.toLowerCase()&&c.parentId===parentId)){alert('این دسته‌بندی قبلاً وجود دارد.');return;}p.categories.push({id:genId(),name,parentId});saveProjects();closeModal('categoryModal');renderScripts()}

function openViewModal(type,item){
  if(!item)return;
  currentView={type,id:item.id};
  $('viewModalTitle').textContent=item.title;
  if(type==='note'){
    $('viewModalMeta').textContent='یادداشت — بروزرسانی: '+fmtDate(item.updatedAt||item.createdAt);
  } else {
    const p=activeProject(),cat=p.categories.find(c=>c.id===item.categoryId),sub=p.categories.find(c=>c.id===item.subcategoryId);
    $('viewModalMeta').textContent='اسکریپت'+(cat?' — '+cat.name:'')+(sub?' › '+sub.name:'');
  }
  $('viewModalBody').textContent=item.body;
  openModal('viewModal');
}
function editFromView(){
  const p=activeProject();
  closeModal('viewModal');
  if(currentView.type==='note') openNoteModal(p.notes.find(n=>n.id===currentView.id));
  else if(currentView.type==='script') openScriptModal(p.scripts.find(s=>s.id===currentView.id));
}

window.addEventListener('resize',()=>{if(activeProjectId && $('view-dashboard')?.classList.contains('active-view'))renderDashboard()});
document.addEventListener('DOMContentLoaded',init);
