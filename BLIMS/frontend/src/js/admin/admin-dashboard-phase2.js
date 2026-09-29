/* =========================================================
   BLIMS ADMIN DASHBOARD — PHASE 2 ANALYTICS
   ---------------------------------------------------------
   FRONTEND-ONLY MOCK DATA


   IMPORTANT:
   - This file is an ADD-ON.
   - DO NOT modify admin-dashboard.js.
   - Uses the EXISTING analytics HTML elements.
   - Backend/API integration will replace the mock data later.
========================================================= */




/* =========================================================
   NEW CODE — MOCK DATA
========================================================= */


const DASHBOARD_PHASE2_MOCK = {


  enrollment: {
    5: [
      { year: "2021–2022", count: 982 },
      { year: "2022–2023", count: 1045 },
      { year: "2023–2024", count: 1128 },
      { year: "2024–2025", count: 1201 },
      { year: "2025–2026", count: 1245 }
    ],


    10: [
      { year: "2016–2017", count: 812 },
      { year: "2017–2018", count: 845 },
      { year: "2018–2019", count: 879 },
      { year: "2019–2020", count: 901 },
      { year: "2020–2021", count: 934 },
      { year: "2021–2022", count: 982 },
      { year: "2022–2023", count: 1045 },
      { year: "2023–2024", count: 1128 },
      { year: "2024–2025", count: 1201 },
      { year: "2025–2026", count: 1245 }
    ]
  },


  attendance: {
    today: {
      present: 1168,
      absent: 77
    },


    week: [
      { day: "Mon", present: 1184, absent: 61 },
      { day: "Tue", present: 1192, absent: 53 },
      { day: "Wed", present: 1175, absent: 70 },
      { day: "Thu", present: 1201, absent: 44 },
      { day: "Fri", present: 1168, absent: 77 }
    ],


    month: [
      { day: "Week 1", rate: 95.2 },
      { day: "Week 2", rate: 96.1 },
      { day: "Week 3", rate: 94.8 },
      { day: "Week 4", rate: 96.4 }
    ]
  },


  grades: [
    { grade: "Grade 1", count: 188 },
    { grade: "Grade 2", count: 201 },
    { grade: "Grade 3", count: 214 },
    { grade: "Grade 4", count: 225 },
    { grade: "Grade 5", count: 207 },
    { grade: "Grade 6", count: 210 }
  ]


};




/* =========================================================
   NEW CODE — ENROLLMENT TREND
========================================================= */


function setupEnrollmentTrend() {


  const select =
    document.getElementById("enrollmentRange");


  if (!select) return;




  function getRange() {


    return String(select.value)
      .toLowerCase()
      .includes("10")
      ? 10
      : 5;


  }




  select.addEventListener("change", () => {


    renderEnrollmentTrend(getRange());


  });




  renderEnrollmentTrend(getRange());


}




function renderEnrollmentTrend(range = 5) {


  const chart =
    document.getElementById("enrollmentChart");


  const line =
    document.getElementById("enrollmentLine");


  const area =
    document.getElementById("enrollmentArea");


  const pointsGroup =
    document.getElementById("enrollmentPoints");


  const xAxis =
    document.getElementById("enrollmentXAxis");


  const yAxis =
    document.getElementById("enrollmentYAxis");


  const summary =
    document.getElementById("enrollmentSummary");




  if (!chart || !line || !pointsGroup) return;




  const data =
    DASHBOARD_PHASE2_MOCK.enrollment[range] ||
    DASHBOARD_PHASE2_MOCK.enrollment[5];




  const width = 560;
  const height = 190;


  const left = 8;
  const right = 8;
  const top = 16;
  const bottom = 20;




  const chartWidth =
    width - left - right;


  const chartHeight =
    height - top - bottom;




  const values =
    data.map(item => item.count);




  const minValue =
    Math.min(...values);


  const maxValue =
    Math.max(...values);




  const valueRange =
    maxValue - minValue || 1;




  const points =
    data.map((item, index) => {


      const x =
        left +
        (
          index /
          Math.max(data.length - 1, 1)
        ) *
        chartWidth;




      const y =
        top +
        chartHeight -
        (
          (item.count - minValue) /
          valueRange
        ) *
        chartHeight;




      return {
        x,
        y,
        ...item
      };


    });




  const linePoints =
    points
      .map(point => `${point.x},${point.y}`)
      .join(" ");




  line.setAttribute(
    "points",
    linePoints
  );




  if (area) {


    const areaPath = [


      `M ${points[0].x} ${top + chartHeight}`,


      ...points.map(
        point =>
          `L ${point.x} ${point.y}`
      ),


      `L ${points[points.length - 1].x} ${top + chartHeight}`,


      "Z"


    ].join(" ");




    area.setAttribute(
      "d",
      areaPath
    );


  }




  pointsGroup.innerHTML =
    points.map(point => {


      return `
        <circle
          cx="${point.x}"
          cy="${point.y}"
          r="4.5"
        >
          <title>
            ${point.year}: ${point.count.toLocaleString()} learners
          </title>
        </circle>
      `;


    }).join("");




  if (xAxis) {


    xAxis.innerHTML =
      points.map(point => {


        return `
          <span>
            ${point.year}
          </span>
        `;


      }).join("");


  }




  if (yAxis) {


    const labels = [
      maxValue,
      Math.round(
        minValue + valueRange * 0.75
      ),
      Math.round(
        minValue + valueRange * 0.50
      ),
      Math.round(
        minValue + valueRange * 0.25
      ),
      minValue
    ];




    yAxis.innerHTML =
      labels.map(value => `
        <span>
          ${value.toLocaleString()}
        </span>
      `).join("");


  }




  if (summary) {


    const current =
      data[data.length - 1];


    const previous =
      data[data.length - 2];




    summary.innerHTML = `


      <span>
        Current school year
      </span>


      <strong>
        ${current.count.toLocaleString()} learners
      </strong>


    `;




    if (previous) {


      const change =
        current.count -
        previous.count;




      const percentage =
        previous.count
          ? (
              change /
              previous.count
            ) * 100
          : 0;




      summary.title =
        `${change >= 0 ? "+" : ""}${change.toLocaleString()} learners (${percentage.toFixed(1)}%) from the previous school year.`;


    }


  }


}




/* =========================================================
   NEW CODE — ATTENDANCE OVERVIEW
========================================================= */


function setupAttendanceOverview() {


  const select =
    document.getElementById("attendancePeriod");


  if (!select) return;




  select.addEventListener(
    "change",
    () => {


      renderAttendanceOverview(
        String(select.value)
          .toLowerCase()
      );


    }
  );




  renderAttendanceOverview(
    String(select.value)
      .toLowerCase()
  );


}




function renderAttendanceOverview(period) {


  const preview =
    document.getElementById(
      "attendancePreview"
    );


  if (!preview) return;




  if (period.includes("week")) {


    renderWeeklyAttendance(preview);


    return;


  }




  if (period.includes("month")) {


    renderMonthlyAttendance(preview);


    return;


  }




  renderTodayAttendance(preview);


}




/* ---------------------------------------------------------
   TODAY
--------------------------------------------------------- */


function renderTodayAttendance(preview) {


  const data =
    DASHBOARD_PHASE2_MOCK.attendance.today;




  const total =
    data.present +
    data.absent;




  const rate =
    total
      ? (data.present / total) * 100
      : 0;




  const donut =
    document.getElementById(
      "attendanceDonut"
    );




  const center =
    document.getElementById(
      "attendanceCenterRate"
    );




  const present =
    document.getElementById(
      "attendancePresent"
    );




  const absent =
    document.getElementById(
      "attendanceAbsent"
    );




  const totalEl =
    document.getElementById(
      "attendanceTotal"
    );




  if (donut) {


    donut.style.background =
      `conic-gradient(
        #10b981 0deg ${rate * 3.6}deg,
        #f06b72 ${rate * 3.6}deg 360deg
      )`;


  }




  if (center) {


    center.textContent =
      `${rate.toFixed(1)}%`;


  }




  if (present) {


    present.textContent =
      data.present.toLocaleString();


  }




  if (absent) {


    absent.textContent =
      data.absent.toLocaleString();


  }




  if (totalEl) {


    totalEl.textContent =
      total.toLocaleString();


  }




  renderAttendanceLegendLayout(
    preview
  );


}




/* ---------------------------------------------------------
   WEEK
--------------------------------------------------------- */


function renderWeeklyAttendance(preview) {


  const data =
    DASHBOARD_PHASE2_MOCK.attendance.week;




  const maxTotal =
    Math.max(
      ...data.map(
        item =>
          item.present +
          item.absent
      )
    );




  preview.innerHTML = `


    <div class="attendance-week-chart"
         style="
           width:100%;
           height:100%;
           display:flex;
           align-items:flex-end;
           justify-content:space-between;
           gap:12px;
           padding:14px 8px 8px;
         ">


      ${data.map(item => {


        const total =
          item.present +
          item.absent;




        const presentHeight =
          (
            item.present /
            maxTotal
          ) * 100;




        const absentHeight =
          (
            item.absent /
            maxTotal
          ) * 100;




        const rate =
          (
            item.present /
            total
          ) * 100;




        return `


          <div
            style="
              flex:1;
              height:100%;
              display:flex;
              flex-direction:column;
              align-items:center;
              justify-content:flex-end;
              gap:5px;
            "
          >


            <span
              style="
                font-size:8px;
                font-weight:800;
                color:rgba(11,44,74,.58);
              "
            >
              ${rate.toFixed(1)}%
            </span>




            <div
              title="${item.day}: ${item.present} present, ${item.absent} absent"
              style="
                width:min(34px,70%);
                height:150px;
                max-height:72%;
                min-height:45px;
                display:flex;
                flex-direction:column;
                justify-content:flex-end;
                overflow:hidden;
                border-radius:8px 8px 4px 4px;
                background:#f2f5f7;
              "
            >


              <div
                style="
                  height:${presentHeight}%;
                  background:#10b981;
                "
              ></div>


              <div
                style="
                  height:${absentHeight}%;
                  background:#f06b72;
                "
              ></div>


            </div>




            <span
              style="
                font-size:8px;
                font-weight:800;
                color:rgba(11,44,74,.48);
              "
            >
              ${item.day}
            </span>


          </div>


        `;


      }).join("")}


    </div>


  `;


}




/* ---------------------------------------------------------
   MONTH
--------------------------------------------------------- */


function renderMonthlyAttendance(preview) {


  const data =
    DASHBOARD_PHASE2_MOCK.attendance.month;




  const width = 560;
  const height = 170;


  const left = 38;
  const right = 12;
  const top = 15;
  const bottom = 30;




  const chartWidth =
    width - left - right;


  const chartHeight =
    height - top - bottom;




  const min = 90;
  const max = 100;




  const points =
    data.map((item, index) => {


      const x =
        left +
        (
          index /
          Math.max(data.length - 1, 1)
        ) *
        chartWidth;




      const y =
        top +
        chartHeight -
        (
          (item.rate - min) /
          (max - min)
        ) *
        chartHeight;




      return {
        x,
        y,
        ...item
      };


    });




  const polyline =
    points
      .map(
        point =>
          `${point.x},${point.y}`
      )
      .join(" ");




  preview.innerHTML = `


    <div
      style="
        width:100%;
        height:100%;
        padding:8px 0;
      "
    >


      <svg
        viewBox="0 0 ${width} ${height}"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        aria-label="Monthly attendance rate"
      >


        ${[90,95,100].map(value => {


          const y =
            top +
            chartHeight -
            (
              (value - min) /
              (max - min)
            ) *
            chartHeight;




          return `


            <line
              x1="${left}"
              y1="${y}"
              x2="${width - right}"
              y2="${y}"
              stroke="rgba(11,44,74,.08)"
              stroke-dasharray="3 4"
            />


            <text
              x="${left - 7}"
              y="${y + 3}"
              text-anchor="end"
              font-size="8"
              fill="rgba(11,44,74,.42)"
            >
              ${value}%
            </text>


          `;


        }).join("")}




        <polyline
          points="${polyline}"
          fill="none"
          stroke="#1976d2"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />




        ${points.map(point => `


          <circle
            cx="${point.x}"
            cy="${point.y}"
            r="4"
            fill="#ffffff"
            stroke="#1976d2"
            stroke-width="2.5"
          >
            <title>
              ${point.day}: ${point.rate}%
            </title>
          </circle>




          <text
            x="${point.x}"
            y="${height - 8}"
            text-anchor="middle"
            font-size="8"
            font-weight="700"
            fill="rgba(11,44,74,.45)"
          >
            ${point.day}
          </text>


        `).join("")}


      </svg>


    </div>


  `;


}




/* ---------------------------------------------------------
   RESTORE EXISTING ATTENDANCE LEGEND
--------------------------------------------------------- */


function renderAttendanceLegendLayout(preview) {


  /*
     The existing HTML already contains the legend.
     Do not rebuild it here.
  */


  const note =
    document.getElementById(
      "attendanceNote"
    );




  if (note) {


    note.textContent =
      "Demo attendance data for frontend development. The API can replace this dataset later.";


  }


}




/* =========================================================
   NEW CODE — LEARNERS BY GRADE LEVEL
========================================================= */


function setupGradeDistribution() {


  const container =
    document.getElementById(
      "gradeBars"
    );


  if (!container) return;




  renderGradeDistribution();


}




function renderGradeDistribution() {


  const container =
    document.getElementById(
      "gradeBars"
    );


  if (!container) return;




  const data =
    DASHBOARD_PHASE2_MOCK.grades;




  const maxValue =
    Math.max(
      ...data.map(
        item => item.count
      )
    );




  container.innerHTML =
    data.map(item => {


      const height =
        maxValue
          ? (
              item.count /
              maxValue
            ) * 100
          : 0;




      return `


        <div
          class="grade-bar-item"
          style="
            flex:1;
            min-width:24px;
            height:100%;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:flex-end;
            gap:5px;
          "
        >


          <strong
            style="
              font-size:8px;
              color:#0b2c4a;
            "
          >
            ${item.count}
          </strong>




          <div
            title="${item.grade}: ${item.count} learners"
            style="
              width:min(34px,70%);
              height:${height}%;
              min-height:12px;
              border-radius:7px 7px 3px 3px;
              background:#1976d2;
            "
          ></div>




          <span
            style="
              font-size:7px;
              line-height:1.1;
              font-weight:800;
              color:rgba(11,44,74,.48);
              white-space:nowrap;
            "
          >
            ${item.grade.replace("Grade ", "G")}
          </span>


        </div>


      `;


    }).join("");




  const note =
    document.getElementById(
      "gradeNote"
    );




  if (note) {


    note.textContent =
      "Demo enrollment distribution for frontend development. Current counts will later come from BLIMS enrollment records.";


  }


}




/* =========================================================
   NEW CODE — INITIALIZATION
========================================================= */


document.addEventListener(
  "DOMContentLoaded",
  () => {


    /*
       This file uses elements that already exist
       in dashboard.html.


       No new dashboard cards are created.
       No existing HTML is replaced.
    */


    setupEnrollmentTrend();


    setupAttendanceOverview();


    setupGradeDistribution();


  }
);




/* =========================================================
   NEW CODE — API INTEGRATION (LATER)
=========================================================


   When backend integration begins, replace
   DASHBOARD_PHASE2_MOCK with data returned by
   the appropriate BLIMS API endpoint.


   Do not connect the API yet.


========================================================= */

