// frontend/src/js/student/student-events.js
document.addEventListener("DOMContentLoaded", () => {
  initTopbarMenu();
  initLogout();
  initEvents();
});

function $(id){ return document.getElementById(id); }

/* ===============================
   TOPBAR
================================= */
function initTopbarMenu(){
  const btn=$("userMenuBtn"), menu=$("userMenu"), box=$("userbox");
  if(!btn||!menu||!box) return;

  btn.addEventListener("click",(e)=>{
    e.stopPropagation();
    menu.classList.toggle("open");
  });

  document.addEventListener("click",(e)=>{
    if(!box.contains(e.target)) menu.classList.remove("open");
  });
}

function initLogout(){
  const btn=$("topbarLogout");
  if(!btn) return;
  btn.addEventListener("click",()=>{
    window.location.href="../../login.html";
  });
}

/* ===============================
   EVENTS (Student - view only)
   - Active SY from Admin: blims_school_years_v1
   - Events from Admin (tries keys):
     blims_events_v1
     blims_school_events_v1
     blims_admin_events_v1
================================= */
function initEvents(){
  const sySelect=$("sySelect");
  const viewFilter=$("viewFilter");
  const typeFilter=$("typeFilter");
  const evSearch=$("evSearch");

  const listEl=$("evList");
  const emptyEl=$("evEmpty");
  const countEl=$("evCount");
  const syLabelEl=$("evSYLabel");

  // modal
  const modal=$("evViewModal");
  const backdrop=$("evViewBackdrop");
  const closeX=$("evViewCloseX");
  const closeBtn=$("evViewCloseBtn");
  const viewTitle=$("evViewTitle");
  const viewSub=$("evViewSub");
  const viewTop=$("evViewTop");
  const viewNotes=$("evViewNotes");

  const LS_SCHOOL_YEARS="blims_school_years_v1";
  const EVENT_KEYS_TO_TRY=[
    "blims_events_v1",
    "blims_school_events_v1",
    "blims_admin_events_v1",
  ];

  const state={
    sy:"",
    q:"",
    view:"all", // all | upcoming | past
    type:"all",
  };

  function readJSON(k,f){
    try{
      const r=localStorage.getItem(k);
      return r?JSON.parse(r):f;
    }catch{return f;}
  }

  function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function clamp(s,n=140){
    const t=String(s||"").trim();
    if(t.length<=n) return t;
    return t.slice(0,n).trim()+"…";
  }

  function getActiveSY(){
    const store=readJSON(LS_SCHOOL_YEARS,null);
    if(!store || !Array.isArray(store.items)) return "";
    const active=store.items.find(x=>x && x.id===store.activeId);
    return active ? String(active.name||"").trim() : "";
  }

  function readEventsAnyKey(){
    for(const k of EVENT_KEYS_TO_TRY){
      const v=readJSON(k,null);
      if(Array.isArray(v)) return {key:k, list:v};
      if(v && typeof v==="object" && Array.isArray(v.items)) return {key:k, list:v.items};
    }
    return {key:"", list:[]};
  }

  function toDateMs(s){
    const d=new Date(s);
    const t=d.getTime();
    return Number.isNaN(t) ? null : t;
  }

  function fmtDateRange(start, end){
    const a = start ? new Date(start) : null;
    const b = end ? new Date(end) : null;

    const okA = a && !Number.isNaN(a.getTime());
    const okB = b && !Number.isNaN(b.getTime());

    const opt={ year:"numeric", month:"short", day:"2-digit" };

    if(okA && okB && start !== end){
      return `${a.toLocaleDateString(undefined,opt)} – ${b.toLocaleDateString(undefined,opt)}`;
    }
    if(okA) return a.toLocaleDateString(undefined,opt);
    return "—";
  }

  function pillClass(type){
    const t=String(type||"").toLowerCase();
    if(t.includes("holiday")) return "holiday";
    if(t.includes("exam")) return "exam";
    if(t.includes("activity")) return "activity";
    if(t.includes("meeting")) return "meeting";
    return "";
  }

  function normalizeEvent(x){
    // tolerate different admin shapes
    const title = x.title ?? x.name ?? "Untitled";
    const type = x.type ?? x.tag ?? x.category ?? "";
    const postedBy = x.postedBy ?? x.author ?? x.createdBy ?? "Admin";
    const location = x.location ?? x.venue ?? "";
    const time = x.time ?? x.timeRange ?? "";
    const notes = x.notes ?? x.description ?? x.details ?? "";
    const schoolYear = x.schoolYear ?? x.sy ?? x.year ?? "";
    const startDate = x.startDate ?? x.date ?? x.start ?? "";
    const endDate = x.endDate ?? x.end ?? x.dateEnd ?? "";

    return {
      raw:x,
      title:String(title||"").trim(),
      type:String(type||"").trim(),
      postedBy:String(postedBy||"Admin").trim() || "Admin",
      location:String(location||"").trim(),
      time:String(time||"").trim(),
      notes:String(notes||"").trim(),
      schoolYear:String(schoolYear||"").trim(),
      startDate:String(startDate||"").trim(),
      endDate:String(endDate||"").trim(),
    };
  }

  function seedMockIfEmpty(activeSY){
    if(!activeSY) return;

    const {key,list}=readEventsAnyKey();
    if(Array.isArray(list) && list.length) return; // already has data

    // seed into default key if none
    const storeKey = EVENT_KEYS_TO_TRY[0];

    const demo=[
      {
        id:"EV-"+Date.now()+"-1",
        title:"School Foundation Day",
        type:"Activity",
        schoolYear:activeSY,
        startDate:"2026-03-12",
        endDate:"2026-03-12",
        time:"8:00 AM – 3:00 PM",
        location:"School Grounds",
        notes:"Wear your P.E. uniform. Bring water and snacks.",
        postedBy:"Admin",
        createdAt: Date.now()
      },
      {
        id:"EV-"+Date.now()+"-2",
        title:"Quarterly Examination Week",
        type:"Exam",
        schoolYear:activeSY,
        startDate:"2026-04-07",
        endDate:"2026-04-11",
        time:"",
        location:"",
        notes:"Please check your schedule and be on time.",
        postedBy:"Admin",
        createdAt: Date.now()
      },
      {
        id:"EV-"+Date.now()+"-3",
        title:"Regular Holiday",
        type:"Holiday",
        schoolYear:activeSY,
        startDate:"2026-05-01",
        endDate:"2026-05-01",
        time:"",
        location:"",
        notes:"No classes.",
        postedBy:"Admin",
        createdAt: Date.now()
      }
    ];

    localStorage.setItem(storeKey, JSON.stringify(demo));
  }

  // modal helpers (same behavior style as admin modals)
  function openModal(){
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden","false");
  }
  function closeModal(){
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden","true");
  }

  function showDetails(ev){
    viewTitle.textContent = ev.title || "Event Details";

    const range = fmtDateRange(ev.startDate, ev.endDate);
    const subParts = [];
    if(range && range !== "—") subParts.push(range);
    if(ev.time) subParts.push(ev.time);
    if(ev.location) subParts.push(ev.location);
    viewSub.textContent = subParts.join(" • ") || "—";

    viewTop.innerHTML = `
      <span class="ev-pill ${pillClass(ev.type)}">${escapeHtml(ev.type || "Event")}</span>
      <span class="ev-by">Posted by: ${escapeHtml(ev.postedBy || "Admin")}</span>
      ${ev.schoolYear ? `<span class="ev-by">SY ${escapeHtml(ev.schoolYear)}</span>` : ""}
    `;

    viewNotes.textContent = ev.notes || "—";

    openModal();
  }

  function buildSYFromAdmin(){
    const activeSY = getActiveSY();

    if(!activeSY){
      sySelect.innerHTML = `<option value="">SY —</option>`;
      sySelect.disabled = true;
      state.sy = "";
      if(syLabelEl) syLabelEl.textContent = "SY —";
      return;
    }

    // Student should default to active; no random options unless you later want archives
    sySelect.innerHTML = `<option value="${escapeHtml(activeSY)}">SY ${escapeHtml(activeSY)}</option>`;
    sySelect.value = activeSY;
    sySelect.disabled = true;

    state.sy = activeSY;
    if(syLabelEl) syLabelEl.textContent = `SY ${activeSY}`;
  }

  function render(){
    buildSYFromAdmin();

    // seed mock so you can see UI now (remove later)
    seedMockIfEmpty(state.sy);

    const { list } = readEventsAnyKey();
    const mapped = (Array.isArray(list) ? list : []).map(normalizeEvent);

    // filter by active SY if event has schoolYear; if missing, treat as current
    let filtered = mapped.filter(ev => !ev.schoolYear || ev.schoolYear === state.sy);

    // view filters
    const now = Date.now();
    if(state.view === "upcoming"){
      filtered = filtered.filter(ev => {
        const t = toDateMs(ev.startDate) ?? toDateMs(ev.endDate);
        return t == null ? true : t >= now;
      });
    }else if(state.view === "past"){
      filtered = filtered.filter(ev => {
        const t = toDateMs(ev.endDate) ?? toDateMs(ev.startDate);
        return t == null ? false : t < now;
      });
    }

    // type filter
    if(state.type !== "all"){
      filtered = filtered.filter(ev => String(ev.type||"").toLowerCase() === state.type);
    }

    // search
    const q = String(state.q||"").trim().toLowerCase();
    if(q){
      filtered = filtered.filter(ev => {
        const hay = `${ev.title} ${ev.notes} ${ev.location}`.toLowerCase();
        return hay.includes(q);
      });
    }

    // sort by start date ascending (events list feel)
    filtered.sort((a,b)=>{
      const ta = toDateMs(a.startDate) ?? 0;
      const tb = toDateMs(b.startDate) ?? 0;
      return ta - tb;
    });

    listEl.innerHTML = "";

    if(!filtered.length){
      emptyEl.classList.remove("hidden");
      if(countEl) countEl.textContent = "0 events";
      return;
    }

    emptyEl.classList.add("hidden");
    if(countEl) countEl.textContent = `${filtered.length} event${filtered.length===1?"":"s"}`;

    filtered.forEach(ev=>{
      const item = document.createElement("div");
      item.className = "ev-item";
      item.tabIndex = 0;

      const dateText = fmtDateRange(ev.startDate, ev.endDate);
      const metaParts = [
        dateText !== "—" ? dateText : "",
        ev.time || "",
        ev.location || ""
      ].filter(Boolean);

      item.innerHTML = `
        <div class="ev-main">
          <h3 class="ev-title">${escapeHtml(ev.title || "Untitled")}</h3>
          <div class="ev-meta">
            ${metaParts.map(x=>`<span>${escapeHtml(x)}</span>`).join("")}
          </div>
          <div class="ev-desc">${escapeHtml(clamp(ev.notes || "", 160))}</div>
        </div>

        <div class="ev-right">
          <span class="ev-by">Admin</span>
          <span class="ev-pill ${pillClass(ev.type)}">${escapeHtml(ev.type || "Event")}</span>
        </div>
      `;

      item.addEventListener("click",()=>showDetails(ev));
      item.addEventListener("keydown",(e)=>{
        if(e.key==="Enter" || e.key===" "){
          e.preventDefault();
          showDetails(ev);
        }
      });

      listEl.appendChild(item);
    });
  }

  // events
  viewFilter.addEventListener("change", ()=>{
    state.view = viewFilter.value || "all";
    render();
  });

  typeFilter.addEventListener("change", ()=>{
    state.type = typeFilter.value || "all";
    render();
  });

  evSearch.addEventListener("input",(e)=>{
    state.q = e.target.value || "";
    render();
  });

  // modal close
  backdrop.addEventListener("click", closeModal);
  closeX.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);

  document.addEventListener("keydown",(e)=>{
    if(e.key==="Escape" && modal && !modal.classList.contains("hidden")){
      closeModal();
    }
  });

  // boot
  render();
}