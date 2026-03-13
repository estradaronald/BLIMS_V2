// frontend/src/js/student/student-grades.js

document.addEventListener("DOMContentLoaded", () => {
  initTopbarMenu();
  initLogout();
  initGrades();
});

function $(id){ return document.getElementById(id); }

/* ===============================
   TOPBAR
================================= */
function initTopbarMenu(){
  const btn=$("userMenuBtn"), menu=$("userMenu"), box=$("userbox");
  if(!btn||!menu||!box) return;

  btn.addEventListener("click",e=>{
    e.stopPropagation();
    menu.classList.toggle("open");
  });

  document.addEventListener("click",e=>{
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
   GRADES
================================= */
function initGrades(){

  const LS_ACTIVE_CLASS="blims_active_student_class_v1";
  const LS_SCHOOL_YEARS="blims_school_years_v1";
  const LS_GRADES="blims_student_grades_v1";

  const tbody=$("gradesTbody");
  const empty=$("gradesEmpty");
  const sySelect=$("sySelect");
  const gradeSectionEl=$("gradesGradeSection");
  const syLabelEl=$("gradesSYLabel");
  const finalAverageEl=$("finalAverage");
  const promotionStatusEl=$("promotionStatus");

  const tabs=document.querySelectorAll(".grades-tab");

  const state={
    quarter:"q1",
    sy:""
  };

  function readJSON(k,f){
    try{
      const r=localStorage.getItem(k);
      return r?JSON.parse(r):f;
    }catch{return f;}
  }

  function getActiveClass(){
    const r=readJSON(LS_ACTIVE_CLASS,null);
    if(r&&r.grade&&r.section) return r;
    return {grade:"Grade 6",section:"A"};
  }

  function getActiveSY(){
    const s=readJSON(LS_SCHOOL_YEARS,null);
    if(!s||!Array.isArray(s.items)) return "";
    const a=s.items.find(x=>x.id===s.activeId);
    return a?String(a.name||""):"";
  }

  function seedIfEmpty(cls,sy){
    const existing=readJSON(LS_GRADES,null);
    if(Array.isArray(existing)&&existing.length) return;

    const demo=[
      {subject:"English",q1:88,q2:90,q3:91,q4:89,grade:cls.grade,section:cls.section,schoolYear:sy},
      {subject:"Mathematics",q1:85,q2:87,q3:89,q4:90,grade:cls.grade,section:cls.section,schoolYear:sy},
      {subject:"Science",q1:90,q2:92,q3:93,q4:94,grade:cls.grade,section:cls.section,schoolYear:sy},
      {subject:"Filipino",q1:87,q2:88,q3:90,q4:91,grade:cls.grade,section:cls.section,schoolYear:sy},
    ];

    localStorage.setItem(LS_GRADES,JSON.stringify(demo));
  }

  function computeFinal(row){
    const avg=(row.q1+row.q2+row.q3+row.q4)/4;
    return Math.round(avg);
  }

  function render(){

    const cls=getActiveClass();
    const sy=getActiveSY();
    state.sy=sy;

    if(gradeSectionEl)
      gradeSectionEl.textContent=`${cls.grade} - Section ${cls.section}`;

    if(syLabelEl)
      syLabelEl.textContent=sy?`SY ${sy}`:"SY —";

    sySelect.innerHTML=sy?`<option>${sy}</option>`:`<option>SY —</option>`;
    sySelect.disabled=true;

    if(sy) seedIfEmpty(cls,sy);

    const all=readJSON(LS_GRADES,[]);
    let list=Array.isArray(all)?all:[];
    list=list.filter(x=>x.grade===cls.grade && x.section===cls.section && (!x.schoolYear||x.schoolYear===sy));

    tbody.innerHTML="";

    if(!list.length){
      empty.classList.remove("hidden");
      finalAverageEl.textContent="—";
      promotionStatusEl.textContent="—";
      return;
    }

    empty.classList.add("hidden");

    let finalTotal=0;

    list.forEach(row=>{
      const final=computeFinal(row);
      finalTotal+=final;

      let gradeVal;

      if(state.quarter==="final"){
        gradeVal=final;
      }else{
        gradeVal=row[state.quarter] ?? "—";
      }

      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td>${row.subject}</td>
        <td style="text-align:right;">${gradeVal}</td>
        <td>${gradeVal>=75?"Passed":"Needs Improvement"}</td>
      `;
      tbody.appendChild(tr);
    });

    const overall=Math.round(finalTotal/list.length);
    finalAverageEl.textContent=overall;
    promotionStatusEl.textContent=overall>=75?"Promoted":"For Review";
  }

  tabs.forEach(btn=>{
    btn.addEventListener("click",()=>{
      tabs.forEach(t=>{
        t.classList.remove("active");
        t.setAttribute("aria-selected","false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected","true");
      state.quarter=btn.dataset.q;
      render();
    });
  });

  render();
}