/* Sales Desk v2 - project-based sales CRM, localStorage only */
const LS_PROJECTS = 'salesdesk_projects_v2';
const LS_ACTIVE = 'salesdesk_active_project_v2';
const TERMINAL = ['customer','rejected','closed'];

const STATUS_LABELS = {
  'not-called':'تماس گرفته نشده','called':'تماس گرفته شده','follow-up':'پیگیری',
  'interested':'علاقه‌مند','customer':'فروش موفق','rejected':'رد شده','closed':'بسته شده'
};

let projects = [];
let activeProjectId = null;
let selectedCategoryId = 'all';
let currentView = {type:'', id:''};

const $ = id => document.getElementById(id);
const genId = () => 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
const todayStr = () => new Date().toISOString().slice(0,10);
const escapeHtml = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fa-IR') : '—';

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
function saveProjects(){ localStorage.setItem(LS_PROJECTS, JSON.stringify(projects)); }
function loadProjects(){
  try { projects = JSON.parse(localStorage.getItem(LS_PROJECTS)) || []; } catch { projects=[]; }
  // One-time migration of the original single-project app.
  if (!projects.length) {
    let oldLeads=[], oldLog=[];
    try { oldLeads=JSON.parse(localStorage.getItem('stc_leads'))||[]; } catch {}
    try { oldLog=JSON.parse(localStorage.getItem('stc_callLog'))||[]; } catch {}
    const p=makeProject('پروژه اول','پروژه مهاجرت‌داده‌شده از نسخه قبلی');
    p.leads=oldLeads.filter(l=>!TERMINAL.includes(l.status));
    p.archive=oldLeads.filter(l=>TERMINAL.includes(l.status)).map(l=>({...l, archivedAt:l.updatedAt||todayStr()}));
    p.callLog=oldLog;
    projects=[p]; saveProjects();
  }
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
  document.querySelectorAll('.nav-tab').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  document.querySelectorAll('[data-view-link]').forEach(b=>b.onclick=()=>showView(b.dataset.viewLink));
  $('dashboardAddLead').onclick=()=>openLeadModal();
  $('addLeadBtn').onclick=()=>openLeadModal();
  $('searchInput').oninput=renderLeads; $('filterStatus').onchange=renderLeads;
  $('leadsTableBody').onclick=handleLeadAction; $('leadsTableBody').onchange=handleLeadChange;
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
  if(view==='leads')renderLeads();
  if(view==='archive')renderArchive();
  if(view==='tasks')renderTasks();
  if(view==='notes')renderNotes();
  if(view==='scripts')renderScripts();
}
function openModal(id){$(id).classList.remove('hidden')}
function closeModal(id){$(id).classList.add('hidden')}
function renderAll(){renderDashboard();renderLeads();renderArchive();renderTasks();renderNotes();renderScripts();}

function stats(){
  const p=activeProject(), logs=p.callLog;
  return {
    total:p.leads.length, calls:logs.length, interested:p.leads.filter(l=>l.status==='interested').length,
    followups:p.leads.filter(l=>l.status==='follow-up').length, won:p.archive.filter(l=>l.archiveReason==='customer').length,
    lost:p.archive.filter(l=>['rejected','closed'].includes(l.archiveReason)).length
  };
}
function renderDashboard(){
  const p=activeProject(); if(!p)return; const s=stats();
  $('statTotal').textContent=s.total;$('statCalls').textContent=s.calls;$('statInterested').textContent=s.interested;
  $('statFollowups').textContent=s.followups;$('statWon').textContent=s.won;$('statLost').textContent=s.lost;
  drawLineChart($('callsChart'), callsByDay(p,14));
  drawBarChart($('statusChart'), Object.entries(STATUS_LABELS).filter(([k])=>k!=='not-called').map(([k,v])=>({label:v,value:p.leads.filter(l=>l.status===k).length})));
  drawFunnel($('funnelChart'), [
    {label:'کل لید',value:p.leads.length+p.archive.length},
    {label:'تماس',value:p.callLog.length?new Set(p.callLog.map(x=>x.leadId)).size:0},
    {label:'علاقه‌مند',value:p.leads.filter(l=>l.status==='interested').length+p.archive.filter(l=>l.archiveReason==='customer').length},
    {label:'فروش موفق',value:s.won}
  ]);
  const upcoming=p.leads.filter(l=>l.nextFollowupDate).sort((a,b)=>a.nextFollowupDate.localeCompare(b.nextFollowupDate)).slice(0,6);
  $('upcomingFollowups').innerHTML=upcoming.length?upcoming.map(l=>`<div class="mini-item"><span>${escapeHtml(l.businessName)}</span><b>${fmtDate(l.nextFollowupDate)}</b></div>`).join(''):'<div class="empty-state">پیگیری برنامه‌ریزی‌شده‌ای نیست.</div>';
}
function callsByDay(p,n){
  const arr=[]; for(let i=n-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=d.toISOString().slice(0,10);arr.push({label:d.toLocaleDateString('fa-IR',{month:'numeric',day:'numeric'}),value:p.callLog.filter(x=>x.date===key).length});} return arr;
}
function prepCanvas(c){const r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=r.width*d;c.height=Math.max(220,r.height)*d;const x=c.getContext('2d');x.scale(d,d);return [x,r.width,Math.max(220,r.height)]}
function drawLineChart(c,data){const [x,w,h]=prepCanvas(c);x.clearRect(0,0,w,h);const pad=30,max=Math.max(1,...data.map(d=>d.value));x.beginPath();data.forEach((d,i)=>{const px=pad+i*(w-pad*2)/Math.max(1,data.length-1),py=h-pad-(d.value/max)*(h-pad*2);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();data.forEach((d,i)=>{const px=pad+i*(w-pad*2)/Math.max(1,data.length-1),py=h-pad-(d.value/max)*(h-pad*2);x.beginPath();x.arc(px,py,3,0,Math.PI*2);x.fill();if(i%2===0){x.font='10px sans-serif';x.textAlign='center';x.fillText(d.label,px,h-8)}});x.textAlign='start'}
function drawBarChart(c,data){const [x,w,h]=prepCanvas(c);x.clearRect(0,0,w,h);const pad=28,max=Math.max(1,...data.map(d=>d.value)),bw=(w-pad*2)/Math.max(1,data.length)*.65;data.forEach((d,i)=>{const px=pad+i*(w-pad*2)/data.length+(w-pad*2)/data.length*.17, bh=(d.value/max)*(h-65);x.fillRect(px,h-35-bh,bw,bh);x.font='10px sans-serif';x.textAlign='center';x.fillText(d.label.slice(0,12),px+bw/2,h-18);x.fillText(d.value,px+bw/2,h-40-bh)});x.textAlign='start'}
function drawFunnel(c,data){const [x,w,h]=prepCanvas(c);x.clearRect(0,0,w,h);const max=Math.max(1,data[0]?.value||0);data.forEach((d,i)=>{const ww=(w-50)*(d.value/max)*(1-i*.12), yy=15+i*48,xx=(w-ww)/2;x.fillRect(xx,yy,ww,32);x.fillStyle='white';x.font='12px sans-serif';x.textAlign='center';x.fillText(`${d.label}: ${d.value}`,w/2,yy+21);x.fillStyle='black'});x.textAlign='start'}

function getFilteredLeads(){const p=activeProject(),q=$('searchInput').value.trim().toLowerCase(),sf=$('filterStatus').value;return p.leads.filter(l=>(!sf||l.status===sf)&&(!q||[l.businessName,l.industry,l.phone,l.contactName].some(v=>(v||'').toLowerCase().includes(q))))}
function renderLeads(){
  const p=activeProject(); if(!p)return;
  $('filterStatus').innerHTML='<option value="">همه وضعیت‌ها</option>'+Object.entries(STATUS_LABELS).filter(([k])=>!TERMINAL.includes(k)).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
  const rows=getFilteredLeads();$('tableWrap').classList.toggle('is-empty',!rows.length);
  $('leadsTableBody').innerHTML=rows.map(l=>`<tr><td><strong>${escapeHtml(l.businessName)}</strong></td><td>${escapeHtml(l.contactName)||'—'}</td><td>${escapeHtml(l.industry)||'—'}</td><td>${escapeHtml(l.phone)}</td><td><select class="status-select" data-id="${l.id}">${Object.entries(STATUS_LABELS).filter(([k])=>!TERMINAL.includes(k)).map(([k,v])=>`<option value="${k}" ${l.status===k?'selected':''}>${v}</option>`).join('')}</select></td><td>${fmtDate(l.nextFollowupDate)}</td><td>${fmtDate(l.lastCallDate)}</td><td class="actions-cell"><button class="btn btn-sm btn-call" data-action="call" data-id="${l.id}">ثبت تماس</button><button class="btn btn-sm btn-edit" data-action="edit" data-id="${l.id}">ویرایش</button><button class="btn btn-sm btn-delete" data-action="delete" data-id="${l.id}">حذف</button></td></tr>`).join('');
}
function handleLeadChange(e){if(!e.target.classList.contains('status-select'))return;const l=activeProject().leads.find(x=>x.id===e.target.dataset.id);if(l){l.status=e.target.value;if(TERMINAL.includes(l.status))archiveLead(l,l.status);saveProjects();renderAll()}}
function handleLeadAction(e){const b=e.target.closest('[data-action]');if(!b)return;const p=activeProject(),l=p.leads.find(x=>x.id===b.dataset.id);if(!l)return;if(b.dataset.action==='call')openCallModal(l);if(b.dataset.action==='edit')openLeadModal(l);if(b.dataset.action==='delete'&&confirm(`«${l.businessName}» حذف شود؟`)){p.leads=p.leads.filter(x=>x.id!==l.id);p.callLog=p.callLog.filter(x=>x.leadId!==l.id);saveProjects();renderAll()}}
function openLeadModal(l=null){$('leadForm').reset();$('leadId').value=l?.id||'';$('leadModalTitle').textContent=l?'ویرایش لید':'افزودن لید جدید';if(l){$('leadBusinessName').value=l.businessName||'';$('leadContactName').value=l.contactName||'';$('leadIndustry').value=l.industry||'';$('leadPhone').value=l.phone||'';$('leadWebsite').value=l.website||'';$('leadNotes').value=l.notes||''}openModal('leadModal');$('leadBusinessName').focus()}
function saveLead(e){e.preventDefault();const p=activeProject(),id=$('leadId').value,base={businessName:$('leadBusinessName').value.trim(),contactName:$('leadContactName').value.trim(),industry:$('leadIndustry').value.trim(),phone:$('leadPhone').value.trim(),website:$('leadWebsite').value.trim(),notes:$('leadNotes').value.trim()};if(id){Object.assign(p.leads.find(l=>l.id===id),base)}else p.leads.push({id:genId(),...base,status:'not-called',lastCallDate:'',nextFollowupDate:'',lastCallOutcome:'',createdAt:todayStr()});saveProjects();closeModal('leadModal');renderAll()}

function openCallModal(l){$('callForm').reset();$('callLeadId').value=l.id;$('callLeadName').textContent=l.businessName;$('callStatus').innerHTML=Object.entries(STATUS_LABELS).filter(([k])=>!TERMINAL.includes(k)).map(([k,v])=>`<option value="${k}" ${l.status===k?'selected':''}>${v}</option>`).join('')+'<option value="customer">فروش موفق — انتقال به بایگانی</option><option value="rejected">رد شد — انتقال به بایگانی</option><option value="closed">بسته شد — انتقال به بایگانی</option>';$('callNextFollowup').value=l.nextFollowupDate||'';openModal('callModal')}
function saveCall(e){e.preventDefault();const p=activeProject(),l=p.leads.find(x=>x.id===$('callLeadId').value);if(!l)return;const status=$('callStatus').value,date=todayStr(),note=$('callNoteText').value.trim();l.status=status;l.lastCallDate=date;l.lastCallOutcome=$('callOutcome').value;l.nextFollowupDate=$('callNextFollowup').value;if(note)l.notes=(l.notes?l.notes+'\n':'')+`[${date}] ${note}`;p.callLog.push({id:genId(),leadId:l.id,date,outcome:l.lastCallOutcome,newStatus:status,note});if(TERMINAL.includes(status))archiveLead(l,status);saveProjects();closeModal('callModal');renderAll()}
function archiveLead(l,reason){const p=activeProject();const copy={...l,archiveReason:reason,archivedAt:todayStr()};p.archive.unshift(copy);p.leads=p.leads.filter(x=>x.id!==l.id);}

function renderArchive(){const p=activeProject();if(!p)return;$('archiveCount').textContent=p.archive.length;$('archiveWrap').classList.toggle('is-empty',!p.archive.length);$('archiveTableBody').innerHTML=p.archive.map(l=>`<tr><td><strong>${escapeHtml(l.businessName)}</strong></td><td>${escapeHtml(l.phone)}</td><td><span class="badge ${l.archiveReason==='customer'?'badge-success':'badge-danger'}">${STATUS_LABELS[l.archiveReason]||'بسته شده'}</span></td><td>${fmtDate(l.archivedAt)}</td><td class="note-cell">${escapeHtml((l.notes||'').split('\n').slice(-1)[0])||'—'}</td><td><button class="btn btn-sm btn-restore" data-restore="${l.id}">بازگردانی</button><button class="btn btn-sm btn-delete" data-archive-delete="${l.id}">حذف</button></td></tr>`).join('');$('archiveTableBody').onclick=e=>{const p=activeProject(),r=e.target.closest('[data-restore]'),d=e.target.closest('[data-archive-delete]');if(r){const l=p.archive.find(x=>x.id===r.dataset.restore);if(l){l.status='follow-up';delete l.archiveReason;delete l.archivedAt;p.leads.push(l);p.archive=p.archive.filter(x=>x.id!==r.dataset.restore);saveProjects();renderAll()}}if(d&&confirm('این رکورد برای همیشه حذف شود؟')){p.archive=p.archive.filter(x=>x.id!==d.dataset.archiveDelete);saveProjects();renderArchive();renderDashboard()}}}

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
function saveCategory(e){e.preventDefault();const p=activeProject();p.categories.push({id:genId(),name:$('categoryName').value.trim(),parentId:$('categoryParent').value});saveProjects();closeModal('categoryModal');renderScripts()}

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

window.addEventListener('resize',()=>{if(activeProjectId)renderDashboard()});
document.addEventListener('DOMContentLoaded',init);
