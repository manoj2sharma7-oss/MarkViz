const EXAMS = ["First Term", "Second Term", "Third Term", "Annual Exam"];
const MAX = 55;
const defaultSubjects = [
  "English",
  "Mathematics",
  "Computer",
  "Science",
  "Social Studies",
  "Health & Physical Education",
  "H.K",
  "I.A",
];
const secondarySubjects = defaultSubjects.slice(0, 7);
const state = {
  students: [],
  level: "primary",
  primarySubjects: [...defaultSubjects],
  secondarySubjects: [...secondarySubjects],
  subjects: [...defaultSubjects],
  testSubjects: [...defaultSubjects],
  testFullMarks: 20,
  testPassMarks: 8,
  marks: {},
  testMarks: {},
  completedExams: [],
  currentExam: 0,
  page: "dashboard",
};
let charts = {};
const chartColors = [
  "#2563eb",
  "#0f9f9a",
  "#f97316",
  "#8b5cf6",
  "#e11d48",
  "#d4a72c",
  "#0891b2",
  "#64748b",
];
const chartBorders = [
  "#1d4ed8",
  "#0f766e",
  "#c2410c",
  "#6d28d9",
  "#be123c",
  "#a16207",
  "#0e7490",
  "#475569",
];

function key(e, r) {
  return `${e}-${r}`;
}
let saveTimer;
let workspaceStorageKey = "markviz";
function setWorkspaceStorageKey(email) {
  workspaceStorageKey = `markviz:${String(email || "").trim().toLowerCase()}`;
}
function workspaceData() {
  return {
    students: state.students,
    level: state.level,
    primarySubjects: state.primarySubjects,
    secondarySubjects: state.secondarySubjects,
    subjects: state.subjects,
    testSubjects: state.testSubjects,
    testFullMarks: state.testFullMarks,
    testPassMarks: state.testPassMarks,
    marks: state.marks,
    testMarks: state.testMarks,
    completedExams: state.completedExams,
    currentExam: state.currentExam,
  };
}
function applyWorkspace(x) {
  if (!x) return;
  state.students = x.students || [];
  state.level = x.level === "secondary" ? "secondary" : "primary";
  state.primarySubjects = x.primarySubjects || x.subjects || [...defaultSubjects];
  state.secondarySubjects = x.secondarySubjects || [...secondarySubjects];
  state.subjects = state.level === "secondary" ? state.secondarySubjects : state.primarySubjects;
  state.testSubjects = x.testSubjects || x.subjects || [...defaultSubjects];
  state.testFullMarks = Number.isFinite(x.testFullMarks) && x.testFullMarks > 0 ? x.testFullMarks : 20;
  state.testPassMarks = Number.isFinite(x.testPassMarks) && x.testPassMarks >= 0 && x.testPassMarks <= state.testFullMarks ? x.testPassMarks : 8;
  state.marks = x.marks || {};
  state.testMarks = x.testMarks || {};
  state.completedExams = Array.isArray(x.completedExams)
    ? x.completedExams.filter((i) => Number.isInteger(i) && i >= 0 && i < EXAMS.length)
    : [];
  state.currentExam = Number.isInteger(x.currentExam) && x.currentExam >= 0 && x.currentExam < EXAMS.length ? x.currentExam : 0;
  while (state.currentExam > 0 && !examUnlocked(state.currentExam)) state.currentExam -= 1;
}
async function syncWorkspace(data, keepalive = false) {
  const response = await fetch("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive,
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Unable to save workspace data.");
}
function save() {
  const data = workspaceData();
  localStorage.setItem(workspaceStorageKey, JSON.stringify(data));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => syncWorkspace(data).catch(() => toast("Unable to save workspace data")), 250);
}
window.addEventListener("pagehide", () => {
  clearTimeout(saveTimer);
  syncWorkspace(workspaceData(), true).catch(() => {});
});
async function load() {
  const response = await fetch("/api/workspace", { credentials: "same-origin" });
  if (!response.ok) throw new Error("Unable to load workspace data.");
  const result = await response.json();
  if (result.data) {
    applyWorkspace(result.data);
    localStorage.setItem(workspaceStorageKey, JSON.stringify(result.data));
  }
}
function toast(t) {
  const x =
    document.querySelector(".toast") ||
    Object.assign(document.body.appendChild(document.createElement("div")), {
      className: "toast",
    });
  x.textContent = t;
  x.style.display = "block";
  setTimeout(() => (x.style.display = "none"), 1800);
}
function examComplete(e) {
  return (
    state.students.length > 0 &&
    state.students.every((s) =>
      state.subjects.every((_, i) => {
        const m = state.marks[key(e, s.roll)]?.[i];
        return m && Number.isFinite(m.t) && Number.isFinite(m.p);
      }),
    )
  );
}
function examUnlocked(e) {
  return e === 0 || state.completedExams.includes(e - 1);
}
function grade(v) {
  v = Number(v);
  if (state.level === "secondary") return secondaryGrade(v);
  if (v >= 45) return "A+";
  if (v >= 40) return "A";
  if (v >= 35) return "B+";
  if (v >= 30) return "B";
  if (v >= 25) return "C+";
  if (v >= 20) return "C";
  if (v >= 18) return "D+";
    return "NG";
}
function secondaryGrade(v) {
  v = Number(v);
  if (v >= 90) return "A+";
  if (v >= 80) return "A";
  if (v >= 70) return "B+";
  if (v >= 60) return "B";
  if (v >= 50) return "C+";
  if (v >= 40) return "C";
  if (v >= 35) return "D";
    return "NG";
}
function subjectPass(m) {
  const theoryPass = state.level === "secondary" ? 27 : 18;
  const practicalPass = state.level === "secondary" ? 10 : 18;
  return m && m.t >= theoryPass && m.p >= practicalPass;
}
function calcStudent(s, e, marks = state.marks) {
  const rows = state.subjects.map((name, i) => {
    const m = marks[key(e, s.roll)]?.[i] || { t: 0, p: 0 };
    return {
      name,
      t: +m.t || 0,
      p: +m.p || 0,
      total: (+m.t || 0) + (+m.p || 0),
      tg: grade(state.level === "secondary" ? (+m.t || 0) + (+m.p || 0) : m.t),
      pg: grade(state.level === "secondary" ? (+m.t || 0) + (+m.p || 0) : m.p),
      pass: subjectPass(m),
    };
  });
  const total = rows.reduce((a, r) => a + r.total, 0),
    max = state.subjects.length * 100,
    pct = max ? (total / max) * 100 : 0;
  const allPass = rows.every((r) => r.pass);
  const gpa = rows.length
    ? rows.reduce(
        (a, r) =>
          a +
          (state.level === "secondary"
            ? gradePoint(r.total)
            : (gradePoint(r.t) + gradePoint(r.p)) / 2),
        0,
      ) / rows.length
    : 0;
  return {
    rows,
    total,
    max,
    pct,
    allPass,
    gpa: +gpa.toFixed(2),
    division:
      pct >= 80
        ? "Distinction"
        : pct >= 60
          ? "First"
          : pct >= 45
            ? "Second"
            : pct >= 32
              ? "Third"
              : "NG",
  };
}
function testGrade(v) {
  v = Number(v);
  const percentage = state.testFullMarks ? (v / state.testFullMarks) * 100 : 0;
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C+";
  if (percentage >= 45) return "C";
  if (percentage >= 40) return "D";
  return "NG";
}
function calcTestStudent(s) {
  const rows = state.testSubjects.map((name, i) => {
    const m = state.testMarks[key("test", s.roll)]?.[i] || {};
    const theory = +m.t || 0;
    return {
      name,
      t: theory,
      total: theory,
      grade: testGrade(theory),
      pass: theory >= state.testPassMarks,
    };
  });
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const max = state.testSubjects.length * state.testFullMarks;
  return {
    rows,
    total,
    max,
    pct: max ? (total / max) * 100 : 0,
    allPass: rows.every((row) => row.pass),
  };
}
function gradePoint(v) {
  if (state.level === "secondary") {
    return (
      { "A+": 4, A: 3.6, "B+": 3.2, B: 2.8, "C+": 2.4, C: 2, D: 1.6, NG: 0 }[
        grade(v)
      ] ?? 0
    );
  }
  return (
    { "A+": 4, A: 3.6, "B+": 3.2, B: 2.8, "C+": 2.4, C: 2, "D+": 1.6, NG: 0 }[
      grade(v)
    ] ?? 0
  );
}
function destroyCharts() {
  Object.values(charts).forEach((c) => c.destroy());
  charts = {};
}
function canvas(id, type, data, options = {}, plugins = []) {
  const el = document.getElementById(id);
  if (!el) return;
  const isCircular = type === "pie" || type === "doughnut";
  const datasets = data.datasets.map((dataset, datasetIndex) => {
    const colors = isCircular ? chartColors : [chartColors[datasetIndex]];
    const borders = isCircular ? chartBorders : [chartBorders[datasetIndex]];
    return {
      ...dataset,
      backgroundColor: dataset.backgroundColor ||
        (dataset.data || []).map((_, index) => colors[index % colors.length]),
      borderColor: dataset.borderColor ||
        (dataset.data || []).map((_, index) => borders[index % borders.length]),
      borderWidth: dataset.borderWidth ?? (isCircular ? 2 : 1),
      borderRadius: type === "bar" ? 7 : 0,
      hoverBackgroundColor: isCircular
        ? (dataset.data || []).map((_, index) => colors[index % colors.length])
        : undefined,
    };
  });
  const defaultOptions = {
    plugins: {
      legend: {
        labels: {
          color: "#526078",
          usePointStyle: true,
          pointStyle: "circle",
          padding: 16,
          font: { family: "Manrope", size: 11, weight: "700" },
        },
      },
      tooltip: {
        backgroundColor: "#172033",
        titleFont: { family: "Manrope", weight: "800" },
        bodyFont: { family: "Manrope" },
        padding: 12,
        cornerRadius: 10,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#718096", font: { family: "Manrope", size: 10 } },
      },
      y: {
        grid: { color: "#e9edf4" },
        ticks: { color: "#718096", font: { family: "Manrope", size: 10 } },
      },
    },
  };
  charts[id] = new Chart(el, {
    type,
    data: { ...data, datasets },
    plugins,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...defaultOptions,
      ...options,
      plugins: {
        ...defaultOptions.plugins,
        ...options.plugins,
        legend: {
          ...defaultOptions.plugins.legend,
          ...options.plugins?.legend,
          labels: {
            ...defaultOptions.plugins.legend.labels,
            ...options.plugins?.legend?.labels,
          },
        },
      },
      scales: { ...defaultOptions.scales, ...options.scales },
    },
  });
}
const testPieLabels = {
  id: "testPieLabels",
  afterDatasetsDraw(chart) {
    const dataset = chart.data.datasets[0];
    const total = dataset.data.reduce((sum, value) => sum + value, 0);
    if (!total) return;
    const arcs = chart.getDatasetMeta(0).data;
    const context = chart.ctx;
    context.save();
    context.fillStyle = "#fff";
    context.font = "700 14px Segoe UI, Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    arcs.forEach((arc, index) => {
      const percentage = ((dataset.data[index] / total) * 100).toFixed(1);
      const angle = (arc.startAngle + arc.endAngle) / 2;
      const radius = (arc.innerRadius + arc.outerRadius) / 2;
      context.fillText(
        `${percentage}%`,
        arc.x + Math.cos(angle) * radius,
        arc.y + Math.sin(angle) * radius,
      );
    });
    context.restore();
  },
};
function render() {
  document.getElementById("pageTitle").textContent = {
    dashboard: "Dashboard",
    students: "Students",
    marks: "Marks Entry",
    testMarks: "Test Exam Marks Entry",
    testSettings: "Test Exam Settings",
    analysis: "Analysis",
    comparison: "Exam Comparison",
    ledger: "Student Ledger",
    gradeLedger: "Grade Ledger",
    testLedger: "Test Exam Ledger",
    testReport: "Test Exam Report",
    reports: "Reports",
    settings: "Settings",
  }[state.page];
  document.querySelectorAll(".nav-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === state.page);
  });
  const isTestExamPage =
    state.page === "testMarks" ||
    state.page === "testLedger" ||
    state.page === "testReport" ||
    state.page === "testSettings";
  const isSettingsPage = state.page === "settings";
  document.body.classList.toggle(
    "comparison-page",
    state.page === "comparison",
  );
  document.getElementById("examSelect").hidden =
    isTestExamPage || isSettingsPage;
  document.getElementById("logoutBtn").hidden = !isSettingsPage;
  const testExamToggle = document.querySelector(".nav-dropdown-toggle");
  testExamToggle.classList.toggle(
    "active",
    state.page === "marks" ||
      state.page === "ledger" ||
      state.page === "testMarks" ||
      state.page === "testLedger" ||
      state.page === "testReport" ||
      state.page === "testSettings",
  );
  document.getElementById("examSelect").value = state.currentExam;
  document.querySelectorAll("#examSelect option").forEach((option, i) => {
    option.disabled = !examUnlocked(i);
  });
  destroyCharts();
  const c = document.getElementById("content");
  c.className = "content";
  ({
    dashboard: dashboard,
    students: studentsPage,
    marks: marksPage,
    testMarks: testMarksPage,
    analysis: analysisPage,
    comparison: comparisonPage,
    ledger: ledgerPage,
    gradeLedger: gradeLedgerPage,
    testLedger: testLedgerPage,
    testReport: testReportPage,
    testSettings: testSettingsPage,
    reports: reportsPage,
    settings: settingsPage,
  })[state.page](c);
  c.innerHTML = c.innerHTML.replaceAll("FAIL", "NG");
}
function dashboard(c) {
  const completed = EXAMS.filter((_, i) => examComplete(i)).length;
  const avg = state.students.length
    ? state.students.reduce(
        (a, s) => a + calcStudent(s, state.currentExam).pct,
        0,
      ) / state.students.length
    : 0;
  c.innerHTML = `<div class="grid cards">
 <div class="card"><div class="stat-label">Students</div><div class="stat-value">${state.students.length}/${MAX}</div><div class="muted">Registered students</div></div>
 <div class="card"><div class="stat-label">Current Exam</div><div class="stat-value">${EXAMS[state.currentExam]}</div><div class="muted">Available</div></div>
 <div class="card"><div class="stat-label">Class Average</div><div class="stat-value">${avg.toFixed(1)}%</div><div class="muted">Current exam</div></div>
 <div class="card"><div class="stat-label">Exams Completed</div><div class="stat-value">${completed}/4</div><div class="muted">Marks completed</div></div></div>
 <div class="section-title"><h2>Exam Progress</h2></div>
 <div class="card table-wrap"><table><thead><tr><th>Exam</th><th>Status</th><th>Action</th></tr></thead><tbody>${EXAMS.map((x, i) => `<tr><td>${x}</td><td>${!examUnlocked(i) ? '<span class="badge">Locked</span>' : examComplete(i) ? '<span class="badge pass">Completed</span>' : '<span class="badge">Available</span>'}</td><td><button class="btn secondary" onclick="selectExam(${i})" ${examUnlocked(i) ? "" : "disabled"}>${examUnlocked(i) ? "Open" : "Locked"}</button></td></tr>`).join("")}</tbody></table></div>
 <div class="section-title"><h2>Class Performance</h2></div><div class="grid two"><div class="card chart-card"><div class="chart-wrap"><canvas id="avgChart"></canvas></div></div><div class="card chart-card"><div class="chart-wrap"><canvas id="passChart"></canvas></div></div></div>`;
  setTimeout(() => {
    const labels = state.subjects;
    const av = labels.map((_, i) => {
      let n = 0,
        t = 0;
      state.students.forEach((s) => {
        const m = state.marks[key(state.currentExam, s.roll)]?.[i];
        if (m) {
          t += m.t;
          n++;
        }
      });
      return n ? t / n : 0;
    });
    canvas(
      "avgChart",
      "bar",
      {
        labels,
        datasets: [
          {
            label: `Theory Average / ${state.level === "secondary" ? 75 : 50}`,
            data: av,
          },
        ],
      },
      {
        scales: {
          y: { beginAtZero: true, max: state.level === "secondary" ? 75 : 50 },
        },
      },
    );
    let pass = 0,
      fail = 0;
    state.students.forEach((s) =>
      calcStudent(s, state.currentExam).allPass ? pass++ : fail++,
    );
    canvas("passChart", "doughnut", {
      labels: ["Pass", "NG"],
      datasets: [
        {
          data: [pass, fail],
          backgroundColor: ["#16a36f", "#dc4f61"],
          borderColor: ["#12825a", "#bf3c4e"],
        },
      ],
    });
  }, 0);
}
function studentsPage(c) {
  c.innerHTML = `<div class="card"><div class="section-title"><h2>Student Setup</h2><span class="muted">${state.students.length}/${MAX}</span></div>
 <div class="form-grid"><div class="field"><label>Roll No</label><input id="roll" type="number" min="1" max="${MAX}"></div><div class="field"><label>Full Name</label><input id="sname"></div><div class="field"><label>&nbsp;</label><button class="btn primary" onclick="addStudent()">Add Student</button></div></div></div>
 <div class="section-title"><h2>Registered Students</h2></div><div class="card table-wrap"><table><thead><tr><th>Roll</th><th>Full Name</th><th>Actions</th></tr></thead><tbody>${state.students.map((s) => `<tr><td>${s.roll}</td><td>${s.name}</td><td><button class="btn danger" onclick="removeStudent(${s.roll})">Remove</button></td></tr>`).join("") || '<tr><td colspan="3" class="empty">No students yet.</td></tr>'}</tbody></table></div>`;
}
function addStudent() {
  const roll = +document.getElementById("roll").value,
    name = document.getElementById("sname").value.trim();
  if (!roll || roll > MAX || !name) return toast("Enter valid roll and name");
  if (state.students.some((s) => s.roll === roll))
    return toast("Roll number already exists");
  if (state.students.length >= MAX)
    return toast(`Maximum ${MAX} students supported`);
  state.students.push({ roll, name });
  save();
  render();
  toast("Student added");
}
function removeStudent(r) {
  if (confirm("Remove this student?")) {
    state.students = state.students.filter((s) => s.roll !== r);
    Object.keys(state.marks)
      .filter((k) => k.endsWith("-" + r))
      .forEach((k) => delete state.marks[k]);
    delete state.testMarks[key("test", r)];
    save();
    render();
  }
}
function marksPage(c, isTest = false) {
  if (!state.students.length) {
    c.innerHTML = `<div class="card empty">Register students first from the Students section to enter ${isTest ? "Test Exam" : EXAMS[state.currentExam]} marks.</div>`;
    return;
  }
  const marks = isTest ? state.testMarks : state.marks;
  const subjects = isTest ? state.testSubjects : state.subjects;
  const examKey = (roll) =>
    isTest ? key("test", roll) : key(state.currentExam, roll);
  const subjectHeader = isTest
    ? subjects.map((s) => `<th class="subject center">${s}</th>`).join("")
    : subjects
        .map(
          (s) =>
            `<th class="subject center">${s}<br><span class="mini">Theory / Practical</span></th>`,
        )
        .join("");
  const theoryMaximum = state.level === "secondary" ? 75 : 50;
  const practicalMaximum = state.level === "secondary" ? 25 : 50;
  const theoryPass = state.level === "secondary" ? 27 : 18;
  const practicalPass = state.level === "secondary" ? 10 : 18;
  c.innerHTML = `<div class="alert">${isTest ? `Test Exam: ${state.testFullMarks} full marks per subject and ${state.testPassMarks} marks is the pass mark.` : `Each subject: Theory ${theoryMaximum} + Practical ${practicalMaximum}. Pass requires at least ${theoryPass} in theory and ${practicalPass} in practical.`} Blank cells are treated as incomplete.</div>
 <div class="card table-wrap"><table class="marks-table"><thead><tr><th>Roll</th><th>Name</th>${subjectHeader}</tr></thead><tbody>${state.students
   .map(
     (s) =>
      `<tr><td>${s.roll}</td><td>${s.name}</td>${subjects
         .map((_, i) => {
           const m = marks[examKey(s.roll)]?.[i] || {};
           return isTest
             ? `<td class="center"><input type="number" min="0" max="${state.testFullMarks}" value="${m.t ?? ""}" placeholder="Theory" onchange="setMark(${s.roll},${i},'t',this.value,true)"></td>`
             : `<td class="center"><input type="number" min="0" max="${theoryMaximum}" value="${m.t ?? ""}" placeholder="T" onchange="setMark(${s.roll},${i},'t',this.value,false)"> <input type="number" min="0" max="${practicalMaximum}" value="${m.p ?? ""}" placeholder="P" onchange="setMark(${s.roll},${i},'p',this.value,false)"></td>`;
         })
         .join("")}</tr>`,
   )
   .join("")}</tbody></table></div>
 <div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="${isTest ? "finishTestExam()" : "finishExam()"}">${isTest ? "Save Test Exam" : "Save & Complete Exam"}</button><button class="btn secondary" onclick="${isTest ? "resetTestMarks()" : "render()"}">Refresh</button></div>`;
}
function testMarksPage(c) {
  marksPage(c, true);
}
function resetTestMarks() {
  if (!confirm("Clear all Test Exam marks and start entry again?")) return;
  state.testMarks = {};
  save();
  render();
  toast("Test Exam marks cleared");
}
function setMark(r, i, type, v, isTest = false) {
  v = v === "" ? null : +v;
  const maximum = isTest
    ? state.testFullMarks
    : type === "t"
      ? state.level === "secondary"
        ? 75
        : 50
      : state.level === "secondary"
        ? 25
        : 50;
  if (v !== null && (v < 0 || v > maximum))
    return toast(`Marks must be 0–${maximum}`);
  const marks = isTest ? state.testMarks : state.marks;
  const k = isTest ? key("test", r) : key(state.currentExam, r);
  if (!marks[k])
    marks[k] = Array(isTest ? state.testSubjects.length : state.subjects.length)
      .fill(null)
      .map(() => ({}));
  marks[k][i][type] = v;
  save();
}
function finishTestExam() {
  const complete =
    state.students.length > 0 &&
    state.students.every((s) =>
      state.testSubjects.every((_, i) => {
        const m = state.testMarks[key("test", s.roll)]?.[i];
        return m && Number.isFinite(m.t);
      }),
    );
  if (!complete) return toast("Complete every Test Exam mark first");
  toast("Test Exam marks saved");
}
function finishExam() {
  if (!examComplete(state.currentExam))
    return toast("Complete every theory and practical mark first");
  if (!state.completedExams.includes(state.currentExam)) {
    state.completedExams.push(state.currentExam);
    state.completedExams.sort((a, b) => a - b);
    save();
  }
  toast(`${EXAMS[state.currentExam]} completed`);
  render();
}
function analysisPage(c) {
  if (!state.students.length) {
    c.innerHTML =
      '<div class="card empty">Add students and marks to see analysis.</div>';
    return;
  }
  const s = state.students[0],
    r = calcStudent(s, state.currentExam);
  c.innerHTML = `<div class="card"><div class="section-title"><h2>Individual Analysis</h2><div class="toolbar"><select id="studentPick" onchange="analysisStudent(this.value)">${state.students.map((x) => `<option value="${x.roll}">${x.roll} — ${x.name}</option>`).join("")}</select><button class="btn secondary" onclick="downloadIndividualAnalysisPdf()">Download Student PDF</button></div></div><div id="individual"></div></div>
 <div class="section-title"><h2>Subject-wise Class Analysis</h2><button class="btn secondary" onclick="downloadSubjectAnalysisPdf()">Download Class PDF</button></div><div class="grid two"><div class="card chart-card"><div class="chart-wrap"><canvas id="subjectTheory"></canvas></div></div><div class="card chart-card"><div class="chart-wrap"><canvas id="subjectPass"></canvas></div></div></div>`;
  setTimeout(() => drawIndividual(s.roll), 0);
  setTimeout(drawSubjectCharts, 0);
}
function analysisStudent(r) {
  drawIndividual(+r);
}
function drawIndividual(r) {
  const s = state.students.find((x) => x.roll === r),
    x = calcStudent(s, state.currentExam);
  document.getElementById("individual").innerHTML =
    `<div class="grid three"><div><span class="stat-label">Percentage</span><div class="stat-value">${x.pct.toFixed(2)}%</div></div><div><span class="stat-label">GPA</span><div class="stat-value">${x.gpa}</div></div><div><span class="stat-label">Result</span><div class="stat-value">${x.allPass ? "PASS" : "NG"}</div></div></div><div class="chart-wrap"><canvas id="individualChart"></canvas></div>`;
  setTimeout(
    () =>
      canvas(
        "individualChart",
        "bar",
        {
          labels: x.rows.map((a) => a.name),
          datasets: [
            { label: "Theory", data: x.rows.map((a) => a.t) },
            { label: "Practical", data: x.rows.map((a) => a.p) },
          ],
        },
        {
          scales: {
            y: { beginAtZero: true, max: state.level === "secondary" ? 75 : 50 },
          },
        },
      ),
    0,
  );
}
function drawSubjectCharts() {
  const labels = state.subjects,
    avg = labels.map((_, i) => {
      let a = [];
      state.students.forEach((s) => {
        const m = state.marks[key(state.currentExam, s.roll)]?.[i];
        if (m) a.push(m.t);
      });
      return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    });
  const pass = labels.map(
    (_, i) =>
      state.students.filter((s) => {
        const m = state.marks[key(state.currentExam, s.roll)]?.[i];
        return m && m.t >= 18 && m.p >= 18;
      }).length,
  );
  canvas(
    "subjectTheory",
    "bar",
    {
      labels,
      datasets: [
        {
          label: `Theory Average / ${state.level === "secondary" ? 75 : 50}`,
          data: avg,
        },
      ],
    },
    {
      scales: {
        y: { beginAtZero: true, max: state.level === "secondary" ? 75 : 50 },
      },
    },
  );
  canvas(
    "subjectPass",
    "bar",
    { labels, datasets: [{ label: "Students Passing Subject", data: pass }] },
    { scales: { y: { beginAtZero: true, max: state.students.length } } },
  );
}
function analysisPdfDocument(title) {
  if (!window.jspdf?.jsPDF) {
    toast("PDF tools are unavailable while offline");
    return null;
  }
  const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  if (typeof pdf.autoTable !== "function") {
    toast("PDF table tools are unavailable while offline");
    return null;
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text(title, 10, 14);
  return pdf;
}
function addAnalysisChart(pdf, chartId, x, y, width, height) {
  const chart = document.getElementById(chartId);
  if (chart) pdf.addImage(chart.toDataURL("image/png", 1), "PNG", x, y, width, height);
}
function downloadIndividualAnalysisPdf() {
  const roll = Number(document.getElementById("studentPick")?.value);
  const student = state.students.find((item) => item.roll === roll);
  if (!student) return toast("Select a student first");
  const result = calcStudent(student, state.currentExam);
  const pdf = analysisPdfDocument(`${student.name} - Individual Analysis`);
  if (!pdf) return;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`${EXAMS[state.currentExam]} | Roll ${student.roll} | Percentage: ${result.pct.toFixed(2)}% | GPA: ${result.gpa} | Result: ${result.allPass ? "PASS" : "NG"}`, 10, 21);
  addAnalysisChart(pdf, "individualChart", 10, 27, 135, 62);
  pdf.autoTable({
    startY: 96,
    head: [["Subject", "Theory", "Practical", "Total", "Grade", "Result"]],
    body: result.rows.map((row) => [row.name, row.t, row.p, row.total, `${row.tg} / ${row.pg}`, row.pass ? "PASS" : "NG"]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [35, 57, 91] },
  });
  pdf.save(`markviz-${student.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-individual-analysis.pdf`);
}
function downloadSubjectAnalysisPdf() {
  const pdf = analysisPdfDocument(`${EXAMS[state.currentExam]} - Subject-wise Class Analysis`);
  if (!pdf) return;
  const labels = state.subjects;
  const rows = labels.map((subject, index) => {
    const marks = state.students.map((student) => state.marks[key(state.currentExam, student.roll)]?.[index]).filter(Boolean);
    const average = marks.length ? marks.reduce((sum, mark) => sum + (+mark.t || 0), 0) / marks.length : 0;
    const pass = marks.filter((mark) => mark.t >= (state.level === "secondary" ? 27 : 18) && mark.p >= (state.level === "secondary" ? 10 : 18)).length;
    return [subject, `${average.toFixed(2)}/${state.level === "secondary" ? 75 : 50}`, pass, marks.length - pass];
  });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Students: ${state.students.length}`, 10, 21);
  addAnalysisChart(pdf, "subjectTheory", 10, 27, 130, 70);
  addAnalysisChart(pdf, "subjectPass", 155, 27, 130, 70);
  pdf.autoTable({
    startY: 103,
    head: [["Subject", "Theory Average", "Passing Students", "NG Students"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [35, 57, 91] },
  });
  pdf.save(`markviz-${EXAMS[state.currentExam].replaceAll(" ", "-").toLowerCase()}-subject-analysis.pdf`);
}
function comparisonPage(c) {
  if (state.currentExam === 0) {
    c.innerHTML =
      '<div class="card empty">Comparison starts after the Second Term exam is completed.</div>';
    return;
  }
  const examIndexes = Array.from(
    { length: state.currentExam + 1 },
    (_, i) => i,
  );
  const incompleteExam = examIndexes.find(
    (examIndex) => !examComplete(examIndex),
  );
  if (incompleteExam !== undefined) {
    c.innerHTML = `<div class="alert">Complete ${EXAMS[incompleteExam]} before comparing exams up to ${EXAMS[state.currentExam]}.</div>`;
    return;
  }
  const labels = state.students.map((s) => s.name);
  const examData = examIndexes.map((examIndex) => ({
    examIndex,
    values: state.students.map((s) => calcStudent(s, examIndex).pct),
  }));
  const firstExamData = examData[0].values;
  c.innerHTML = `<div class="card"><div class="section-title"><div><h2>${EXAMS[0]} to ${EXAMS[state.currentExam]}</h2><p class="muted">Compare every completed exam for the whole class.</p></div><div class="toolbar"><button class="btn primary" onclick="downloadComparisonGraph()">Download Graph</button><button class="btn secondary" onclick="downloadComparisonCSV()">Download CSV</button><button class="btn secondary" onclick="window.print()">Print / Save PDF</button></div></div><div class="chart-wrap"><canvas id="compareChart"></canvas></div></div><div class="section-title"><h2>Student Comparison</h2></div><div class="card table-wrap"><table><thead><tr><th>Roll</th><th>Name</th>${examIndexes.map((examIndex) => `<th>${EXAMS[examIndex]}</th>`).join("")}<th>Overall Change</th></tr></thead><tbody>${state.students.map((s, i) => `<tr><td>${s.roll}</td><td>${s.name}</td>${examData.map(({ values }) => `<td>${values[i].toFixed(1)}%</td>`).join("")}<td>${(examData[examData.length - 1].values[i] - firstExamData[i]).toFixed(1)}%</td></tr>`).join("")}</tbody></table></div>`;
  setTimeout(
    () =>
      canvas(
        "compareChart",
        "bar",
        {
          labels,
          datasets: examData.map(({ examIndex, values }) => ({
            label: EXAMS[examIndex],
            data: values,
          })),
        },
        { scales: { y: { beginAtZero: true, max: 100 } } },
      ),
    0,
  );
}
function downloadComparisonGraph() {
  const chart = charts.compareChart;
  if (!chart) return toast("Comparison graph is still loading");
  const link = document.createElement("a");
  link.download = `markviz-comparison-${EXAMS[state.currentExam].replaceAll(" ", "-").toLowerCase()}.png`;
  link.href = chart.toBase64Image("image/png", 1);
  link.click();
}
function downloadComparisonCSV() {
  const examIndexes = Array.from(
    { length: state.currentExam + 1 },
    (_, i) => i,
  );
  const rows = [
    ["Roll", "Name", ...examIndexes.map((i) => EXAMS[i]), "Overall Change"],
  ];
  state.students.forEach((student) => {
    const percentages = examIndexes.map(
      (examIndex) => calcStudent(student, examIndex).pct,
    );
    rows.push([
      student.roll,
      student.name,
      ...percentages.map((percentage) => percentage.toFixed(1) + "%"),
      (percentages[percentages.length - 1] - percentages[0]).toFixed(1) + "%",
    ]);
  });
  const blob = new Blob(
    [rows.map((row) => row.map(csvEscape).join(",")).join("\n")],
    { type: "text/csv" },
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `markviz-comparison-${EXAMS[state.currentExam].replaceAll(" ", "-").toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
function ledgerPage(c, isTest = false) {
  if (!state.students.length) {
    c.innerHTML = '<div class="card empty">No students available.</div>';
    return;
  }
  const marks = isTest ? state.testMarks : state.marks;
  const examKey = isTest ? "test" : state.currentExam;
  c.innerHTML = `<div class="card"><div class="section-title"><h2>${isTest ? "Test Exam" : EXAMS[state.currentExam]} Ledger</h2><div class="toolbar"><button class="btn primary" onclick="downloadCSV()">Download CSV</button><button class="btn secondary" onclick="printMarksLedger()">Print Marks Ledger</button></div></div><div class="table-wrap"><table id="marksLedgerTable"><thead><tr><th rowspan="2">Roll</th><th rowspan="2">Name</th>${state.subjects.map((s) => `<th colspan="2">${s}</th>`).join("")}<th rowspan="2">Total</th><th rowspan="2">Full Marks</th><th rowspan="2">%</th><th rowspan="2">Division</th><th rowspan="2">GPA</th><th rowspan="2">Result</th></tr><tr>${state.subjects.map(() => "<th>Theory</th><th>Practical</th>").join("")}</tr></thead><tbody>${state.students
    .map((s) => {
      const x = calcStudent(s, examKey, marks);
      return `<tr><td>${s.roll}</td><td>${s.name}</td>${x.rows.map((r) => `<td>${r.t}</td><td>${r.p}</td>`).join("")}<td><b>${x.total}</b></td><td>${x.max}</td><td>${x.pct.toFixed(2)}</td><td>${x.division}</td><td>${x.gpa}</td><td><span class="badge ${x.allPass ? "pass" : "fail"}">${x.allPass ? "PASS" : "NG"}</span></td></tr>`;
    })
    .join("")}</tbody></table></div></div>
 ${gradeLedgerMarkup()}`;
}
function gradeLedgerMarkup() {
  return `<div class="section-title"><h2>Grade Ledger</h2><div class="toolbar"><button class="btn primary" onclick="downloadGradeCSV()">Download CSV</button><button class="btn secondary" onclick="downloadGradeXLSX()">Download Excel</button><button class="btn secondary" onclick="printGradeLedger()">Print Grade Ledger</button></div></div><div class="card table-wrap"><table id="gradeLedgerTable"><thead><tr><th rowspan="2">Roll No</th><th rowspan="2">Name</th>${state.subjects.map((s) => `<th colspan="2">${s}</th>`).join("")}<th rowspan="2">Overall GPA</th></tr><tr>${state.subjects.map(() => "<th>Theory GPA</th><th>Practical GPA</th>").join("")}</tr></thead><tbody>${state.students.map((s) => { const x = calcStudent(s, state.currentExam, state.marks); return `<tr><td>${s.roll}</td><td>${s.name}</td>${x.rows.map((r) => `<td>${gradeForMark(r.t, state.level === "secondary" ? 75 : 50)}</td><td>${gradeForMark(r.p, state.level === "secondary" ? 25 : 50)}</td>`).join("")}<td>${x.gpa.toFixed(2)}</td></tr>`; }).join("")}</tbody></table></div>`;
}
function gradeLedgerPage(c) {
  if (!state.students.length) {
    c.innerHTML = '<div class="card empty">Register students first to view the Grade Ledger.</div>';
    return;
  }
  c.innerHTML = gradeLedgerMarkup();
}
function gradeForMark(mark, maximum) {
  const percentage = maximum ? (Number(mark) / maximum) * 100 : 0;
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C+";
  if (percentage >= 40) return "C";
  if (percentage >= 35) return "D";
  return "NG";
}
function gradeLedgerRows() {
  const theoryMaximum = state.level === "secondary" ? 75 : 50;
  const practicalMaximum = state.level === "secondary" ? 25 : 50;
  return state.students.map((student) => {
    const result = calcStudent(student, state.currentExam, state.marks);
    return [
      student.roll,
      student.name,
      ...result.rows.flatMap((row) => [
        gradeForMark(row.t, theoryMaximum),
        gradeForMark(row.p, practicalMaximum),
      ]),
      result.gpa.toFixed(2),
    ];
  });
}
function gradeLedgerHeadings() {
  return [
    "Roll No",
    "Name",
    ...state.subjects.flatMap((subject) => [
      `${subject} Theory GPA`,
      `${subject} Practical GPA`,
    ]),
    "Overall GPA",
  ];
}
function downloadGradeCSV() {
  const rows = [gradeLedgerHeadings(), ...gradeLedgerRows()];
  const blob = new Blob(
    [rows.map((row) => row.map(csvEscape).join(",")).join("\n")],
    { type: "text/csv" },
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `markviz-${state.level}-grade-ledger.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
function downloadGradeXLSX() {
  if (!window.XLSX) return toast("Excel export is unavailable while offline");
  const worksheet = XLSX.utils.aoa_to_sheet([
    gradeLedgerHeadings(),
    ...gradeLedgerRows(),
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Grade Ledger");
  XLSX.writeFile(workbook, `markviz-${state.level}-grade-ledger.xlsx`);
}
function printGradeLedger() {
  const table = document.getElementById("gradeLedgerTable");
  if (!table) return;
  printLedgerTable(table, "Grade Ledger");
}
function printMarksLedger() {
  const table = document.getElementById("marksLedgerTable");
  if (!table) return;
  printLedgerTable(table, `${state.level === "secondary" ? "Secondary" : "Primary"} Marks Ledger`);
}
function printTestLedger() {
  const table = document.getElementById("testLedgerTable");
  if (!table) return;
  printLedgerTable(table, "Test Exam Result");
}
function printTestReport(documentTitle = "Print Test Exam Report") {
  const report = document.getElementById("content");
  if (!report) return;
  const printContent = report.cloneNode(true);
  printContent.querySelectorAll("button, .toolbar").forEach((element) => element.remove());
  report.querySelectorAll("canvas").forEach((canvas) => {
    const printedCanvas = printContent.querySelector(`#${canvas.id}`);
    if (!printedCanvas) return;
    const image = document.createElement("img");
    image.src = canvas.toDataURL("image/png");
    image.alt = canvas.getAttribute("aria-label") || "Test Exam report chart";
    printedCanvas.replaceWith(image);
  });
  const printWindow = window.open("", "_blank");
  if (!printWindow) return toast("Allow pop-ups to print the Test Exam report");
  printWindow.document.write(`<!doctype html><html><head><title>${documentTitle}</title><style>
    @page { size: landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #172033; font: 10px Arial, sans-serif; }
    h2 { margin: 0 0 7px; font-size: 15px; }
    h3 { margin: 0 0 5px; font-size: 11px; }
    .section-title { margin: 14px 0 6px; page-break-after: avoid; }
    .grid.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; }
    .card { padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; }
    .stat-label { color: #64748b; font-size: 9px; }
    .stat-value { margin-top: 2px; font-size: 15px; font-weight: 700; }
    .grid.two { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; }
    .chart-card { min-width: 0; padding: 6px; }
    .chart-wrap { height: 150px !important; }
    .chart-wrap img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .table-wrap { overflow: visible; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 8px; }
    th, td { padding: 4px 3px; border: 1px solid #b8c2d1; text-align: center; vertical-align: middle; word-break: normal; }
    th { background: #e9edf5; font-weight: 700; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .badge { font-weight: 700; }
    .pass { color: #087443; }
    .fail { color: #b4233c; }
  </style></head><body>${printContent.innerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 150);
}
function saveTestReportPdf() {
  if (!window.jspdf?.jsPDF)
    return toast("PDF tools are unavailable while offline");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  if (typeof pdf.autoTable !== "function")
    return toast("PDF table tools are unavailable while offline");
  const button = document.querySelector("button[onclick=\"saveTestReportPdf()\"]");
  if (button) button.disabled = true;
  try {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 10;
    const ranked = [...state.students]
      .map((student) => ({ student, result: calcTestStudent(student) }))
      .sort((a, b) => b.result.total - a.result.total);
    const position = new Map(ranked.map(({ student }, index) => [student.roll, index + 1]));
    const passCount = ranked.filter(({ result }) => result.allPass).length;
    const average = ranked.length
      ? ranked.reduce((sum, item) => sum + item.result.pct, 0) / ranked.length
      : 0;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("Test Exam Report", margin, 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Students: ${ranked.length}    Passed: ${passCount}    NG: ${ranked.length - passCount}    Class Average: ${average.toFixed(2)}%`, margin, 21);

    const chartIds = ["testPassChart", "testFailChart"];
    const chartY = 27;
    const chartWidth = (pageWidth - margin * 2 - 8) / 2;
    chartIds.forEach((id, index) => {
      const chart = document.getElementById(id);
      if (chart) pdf.addImage(chart.toDataURL("image/png", 1), "PNG", margin + index * (chartWidth + 8), chartY, chartWidth, 58);
    });

    pdf.autoTable({
      startY: 91,
      head: [["Subject", "Average", "Weak Students", "Pass", "NG"]],
      body: state.testSubjects.map((subject, index) => {
        const marks = ranked.map(({ result }) => result.rows[index]?.t || 0);
        const pass = marks.filter((mark) => mark >= state.testPassMarks).length;
        return [subject, `${(marks.reduce((sum, mark) => sum + mark, 0) / (marks.length || 1)).toFixed(2)}/${state.testFullMarks}`, marks.filter((mark) => mark < state.testPassMarks).length, pass, marks.length - pass];
      }),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [35, 57, 91] },
    });

    pdf.addPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text("Student Report Cards", margin, 14);
    pdf.autoTable({
      startY: 20,
      head: [["Position", "Roll", "Name", ...state.testSubjects, "Total", "%", "Result"]],
      body: ranked.map(({ student, result }) => [
        position.get(student.roll),
        student.roll,
        student.name,
        ...result.rows.map((row) => `${row.t}/${state.testFullMarks}`),
        `${result.total}/${result.max}`,
        `${result.pct.toFixed(2)}%`,
        result.allPass ? "PASS" : "NG",
      ]),
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 2, halign: "center" },
      columnStyles: { 2: { halign: "left" } },
      headStyles: { fillColor: [35, 57, 91] },
      didParseCell: (data) => {
        if (data.column.index === 2) data.cell.styles.halign = "left";
      },
    });
    pdf.save("markviz-test-exam-report.pdf");
  } catch (error) {
    toast("Unable to create the PDF");
  } finally {
    if (button) button.disabled = false;
  }
}
function printLedgerTable(table, title, documentTitle = title) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return toast("Allow pop-ups to print the Test Exam ledger");
  printWindow.document.write(`<html><head><title>${documentTitle}</title><style>@page{size:landscape;margin:7mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}body{font-family:Arial,sans-serif;color:#172033}h1{font-size:18px;margin:0 0 10px;text-align:center}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:8px}th,td{border:1px solid #9ca3af;padding:4px 3px;text-align:center;vertical-align:middle;word-break:break-word}th{background:#e9edf5;font-weight:700}th:first-child,td:first-child{width:5%}th:nth-child(2),td:nth-child(2){width:12%;text-align:left}tbody tr{break-inside:avoid;page-break-inside:avoid}thead{display:table-header-group}</style></head><body><h1>${title}</h1>${table.outerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
function testLedgerPage(c) {
  if (!state.students.length) {
    c.innerHTML =
      '<div class="card empty">Register students first from the Students section.</div>';
    return;
  }
  const positions = new Map(
    [...state.students]
      .sort((a, b) => calcTestStudent(b).total - calcTestStudent(a).total)
      .map((student, index) => [student.roll, index + 1]),
  );
  c.innerHTML = `<div class="card"><div class="section-title"><h2>Test Exam Ledger</h2><div class="toolbar"><button class="btn primary" onclick="downloadTestCSV()">Download CSV</button><button class="btn secondary" onclick="printTestLedger()">Print Test Exam Result</button></div></div><div class="table-wrap"><table id="testLedgerTable"><thead><tr><th rowspan="2">Roll</th><th rowspan="2">Name</th>${state.testSubjects.map((s) => `<th colspan="2">${s}</th>`).join("")}<th rowspan="2">Total</th><th rowspan="2">%</th><th rowspan="2">Position</th><th rowspan="2">Result</th></tr><tr>${state.testSubjects.map(() => "<th>Theory</th><th>Grade</th>").join("")}</tr></thead><tbody>${state.students
    .map((s) => {
      const x = calcTestStudent(s);
      return `<tr><td>${s.roll}</td><td>${s.name}</td>${x.rows.map((r) => `<td>${r.t}</td><td>${r.grade}</td>`).join("")}<td><b>${x.total}</b></td><td>${x.pct.toFixed(2)}</td><td>${positions.get(s.roll)}</td><td><span class="badge ${x.allPass ? "pass" : "fail"}">${x.allPass ? "PASS" : "NG"}</span></td></tr>`;
    })
    .join("")}</tbody></table></div></div>`;
}
function testReportPage(c) {
  if (!state.students.length) {
    c.innerHTML =
      '<div class="card empty">Register students and enter Test Exam marks to create the report.</div>';
    return;
  }
  const results = state.students.map((student) => ({
    student,
    result: calcTestStudent(student),
  }));
  const ranked = [...results].sort((a, b) => b.result.total - a.result.total);
  const passCount = results.filter(({ result }) => result.allPass).length;
  const failCount = results.length - passCount;
  const classAverage =
    results.reduce((sum, { result }) => sum + result.pct, 0) / results.length;
  const subjects = state.testSubjects.map((name, index) => {
    const marks = results.map(({ result }) => result.rows[index].t);
    const pass = marks.filter((mark) => mark >= state.testPassMarks).length;
    return {
      name,
      average: marks.reduce((sum, mark) => sum + mark, 0) / marks.length,
      pass,
      fail: marks.length - pass,
      weak: marks.filter((mark) => mark < state.testPassMarks).length,
    };
  });
  c.innerHTML = `<div class="section-title"><h2>Test Exam Report Card</h2><div class="toolbar"><button class="btn secondary" onclick="printTestReport()">Print</button><button class="btn secondary" onclick="saveTestReportPdf()">Save PDF</button></div></div>
 <div class="grid cards"><div class="card"><div class="stat-label">Students</div><div class="stat-value">${results.length}</div></div><div class="card"><div class="stat-label">Passed</div><div class="stat-value">${passCount}</div></div><div class="card"><div class="stat-label">NG</div><div class="stat-value">${failCount}</div></div><div class="card"><div class="stat-label">Class Average</div><div class="stat-value">${classAverage.toFixed(2)}%</div></div></div>
 <div class="section-title"><h2>Top Three Students</h2></div><div class="card table-wrap"><table><thead><tr><th>Position</th><th>Roll</th><th>Name</th><th>Total</th><th>Percentage</th><th>Result</th></tr></thead><tbody>${ranked
   .slice(0, 3)
   .map(
     ({ student, result }, index) =>
      `<tr><td>${index + 1}</td><td>${student.roll}</td><td>${student.name}</td><td>${result.total}/${result.max}</td><td>${result.pct.toFixed(2)}%</td><td><span class="badge ${result.allPass ? "pass" : "fail"}">${result.allPass ? "PASS" : "NG"}</span></td></tr>`,
   )
   .join("")}</tbody></table></div>
 <div class="section-title"><h2>Subject Performance</h2></div><div class="card table-wrap"><table><thead><tr><th>Subject</th><th>Average Marks</th><th>Weak Students</th><th>Pass</th><th>NG</th></tr></thead><tbody>${subjects.map((subject) => `<tr><td>${subject.name}</td><td>${subject.average.toFixed(2)}/${state.testFullMarks}</td><td>${subject.weak}</td><td>${subject.pass}</td><td>${subject.fail}</td></tr>`).join("")}</tbody></table></div>
 <div class="section-title"><h2>Subject Pass and NG Percentage</h2></div><div class="grid two"><div class="card chart-card"><h3>Pass Percentage by Subject</h3><div class="chart-wrap"><canvas id="testPassChart"></canvas></div></div><div class="card chart-card"><h3>NG Percentage by Subject</h3><div class="chart-wrap"><canvas id="testFailChart"></canvas></div></div></div>
 <div class="section-title"><h2>Student Report Cards</h2></div><div class="card table-wrap"><table><thead><tr><th>Rank</th><th>Roll</th><th>Name</th>${state.testSubjects.map((subject) => `<th>${subject}</th>`).join("")}<th>Total</th><th>%</th><th>Result</th></tr></thead><tbody>${ranked.map(({ student, result }, index) => `<tr><td>${index + 1}</td><td>${student.roll}</td><td>${student.name}</td>${result.rows.map((row) => `<td>${row.t}/${state.testFullMarks}</td>`).join("")}<td>${result.total}/${result.max}</td><td>${result.pct.toFixed(2)}%</td><td><span class="badge ${result.allPass ? "pass" : "fail"}">${result.allPass ? "PASS" : "FAIL"}</span></td></tr>`).join("")}</tbody></table></div>`;
  setTimeout(() => {
    canvas(
      "testPassChart",
      "pie",
      {
        labels: subjects.map((subject) => subject.name),
        datasets: [{ data: subjects.map((subject) => subject.pass) }],
      },
      { plugins: { legend: { position: "bottom" } } },
      [testPieLabels],
    );
    canvas(
      "testFailChart",
      "pie",
      {
        labels: subjects.map((subject) => subject.name),
        datasets: [{ data: subjects.map((subject) => subject.fail) }],
      },
      { plugins: { legend: { position: "bottom" } } },
      [testPieLabels],
    );
  }, 0);
}
function csvEscape(x) {
  return `"${String(x).replaceAll('"', '""')}"`;
}
function downloadTestCSV() {
  const rows = [
    [
      "Roll",
      "Name",
      ...state.testSubjects.flatMap((subject) => [
        `${subject} Theory`,
        `${subject} Grade`,
      ]),
      "Total",
      "Full Marks",
      "Percentage",
      "Result",
    ],
  ];
  state.students.forEach((s) => {
    const x = calcTestStudent(s);
    rows.push([
      s.roll,
      s.name,
      ...x.rows.flatMap((r) => [r.t, r.grade]),
      x.total,
      x.max,
      x.pct.toFixed(2),
      x.allPass ? "PASS" : "NG",
    ]);
  });
  const blob = new Blob(
    [rows.map((r) => r.map(csvEscape).join(",")).join("\n")],
    { type: "text/csv" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "markviz-test-exam-ledger.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
function downloadCSV() {
  let rows = [
    [
      "Roll",
      "Name",
      ...state.subjects.flatMap((s) => [
        s + " Theory",
        s + " Practical",
        s + " Total",
      ]),
      "Total",
      "Full Marks",
      "Percentage",
      "Division",
      "GPA",
      "Result",
    ],
  ];
  state.students.forEach((s) => {
    const x = calcStudent(s, state.currentExam);
    rows.push([
      s.roll,
      s.name,
      ...x.rows.flatMap((r) => [r.t, r.p, r.total]),
      x.total,
      x.max,
      x.pct.toFixed(2),
      x.division,
      x.gpa,
      x.allPass ? "PASS" : "NG",
    ]);
  });
  const blob = new Blob(
    [rows.map((r) => r.map(csvEscape).join(",")).join("\n")],
    { type: "text/csv" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `markviz-${EXAMS[state.currentExam].replaceAll(" ", "-").toLowerCase()}-ledger.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function reportsPage(c) {
  if (!state.students.length) {
    c.innerHTML = '<div class="card empty">No report data.</div>';
    return;
  }
  const results = state.students.map((student) => ({
    student,
    result: calcStudent(student, state.currentExam),
  }));
  const ranked = [...results].sort((a, b) => b.result.pct - a.result.pct);
  const average = results.reduce((sum, item) => sum + item.result.pct, 0) / results.length;
  const passCount = results.filter((item) => item.result.allPass).length;
  const best = ranked[0];
  const theoryMaximum = state.level === "secondary" ? 75 : 50;
  const subjectStats = state.subjects.map((subject, index) => {
    const marks = state.students
      .map((student) => state.marks[key(state.currentExam, student.roll)]?.[index])
      .filter(Boolean);
    const averageTheory = marks.length
      ? marks.reduce((sum, mark) => sum + (+mark.t || 0), 0) / marks.length
      : 0;
    const passing = marks.filter((mark) => subjectPass(mark)).length;
    return { subject, averageTheory, passing, ng: marks.length - passing };
  });
  const report = `${EXAMS[state.currentExam]} CLASS RESULT REPORT\n\nTotal students: ${state.students.length}\nClass average: ${average.toFixed(2)}%\nPass: ${passCount}\nNG: ${state.students.length - passCount}\nHighest performer: ${best.student.name} (Roll ${best.student.roll}) — ${best.result.pct.toFixed(2)}%\n\nSubject performance:\n${subjectStats.map((item) => `- ${item.subject}: theory average ${item.averageTheory.toFixed(2)}/${theoryMaximum}`).join("\n")}`;
  c.innerHTML = `<div class="section-title"><div><span class="eyebrow"><span class="eyebrow-dot"></span>${EXAMS[state.currentExam].toUpperCase()} REPORT</span><h2>Class Result Overview</h2><p class="muted">A clear summary of performance, outcomes, and subject progress.</p></div><div class="toolbar"><button class="btn secondary" onclick="copyReport()">Copy Report</button><button class="btn primary" onclick="downloadMainReportPdf()">Download PDF</button></div></div>
 <div class="grid cards"><div class="card"><span class="stat-label">Students</span><div class="stat-value">${state.students.length}</div><span class="muted">In this class</span></div><div class="card"><span class="stat-label">Class Average</span><div class="stat-value">${average.toFixed(1)}%</div><span class="muted">Overall performance</span></div><div class="card"><span class="stat-label">Passed</span><div class="stat-value">${passCount}</div><span class="muted">${((passCount / state.students.length) * 100).toFixed(1)}% of class</span></div><div class="card"><span class="stat-label">Top Performer</span><div class="stat-value" style="font-size:20px">${best.student.name}</div><span class="muted">${best.result.pct.toFixed(1)}% · Roll ${best.student.roll}</span></div></div>
 <div class="grid two"><div class="card chart-card"><div class="section-title"><h2>Subject Averages</h2><span class="muted">Theory marks</span></div><div class="chart-wrap"><canvas id="reportSubjectChart"></canvas></div></div><div class="card chart-card"><div class="section-title"><h2>Class Outcomes</h2><span class="muted">Pass vs NG</span></div><div class="chart-wrap"><canvas id="reportOutcomeChart"></canvas></div></div></div>
 <div class="section-title"><h2>Top Performers</h2><span class="muted">Ranked by percentage</span></div><div class="card table-wrap"><table><thead><tr><th>Roll</th><th>Name</th><th>Total</th><th>Percentage</th><th>GPA</th><th>Position</th><th>Result</th></tr></thead><tbody>${ranked.slice(0, 5).map((item, index) => `<tr><td>${item.student.roll}</td><td>${item.student.name}</td><td>${item.result.total}/${item.result.max}</td><td>${item.result.pct.toFixed(2)}%</td><td>${item.result.gpa}</td><td>${index + 1}</td><td><span class="badge ${item.result.allPass ? "pass" : "fail"}">${item.result.allPass ? "PASS" : "NG"}</span></td></tr>`).join("")}</tbody></table></div>
 <div class="section-title"><h2>Subject Performance</h2><span class="muted">Theory average and outcomes</span></div><div class="card table-wrap"><table id="mainReportTable"><thead><tr><th>Subject</th><th>Theory Average</th><th>Passed</th><th>NG</th></tr></thead><tbody>${subjectStats.map((item) => `<tr><td>${item.subject}</td><td>${item.averageTheory.toFixed(2)}/${theoryMaximum}</td><td>${item.passing}</td><td>${item.ng}</td></tr>`).join("")}</tbody></table></div><div id="reportText" hidden>${report}</div>`;
  setTimeout(() => {
    canvas("reportSubjectChart", "bar", {
      labels: subjectStats.map((item) => item.subject),
      datasets: [{ label: `Theory Average / ${theoryMaximum}`, data: subjectStats.map((item) => item.averageTheory) }],
    }, { scales: { y: { beginAtZero: true, max: theoryMaximum } } });
    canvas("reportOutcomeChart", "doughnut", {
      labels: ["Pass", "NG"],
      datasets: [{ data: [passCount, state.students.length - passCount], backgroundColor: ["#16a36f", "#dc4f61"], borderColor: ["#12825a", "#bf3c4e"] }],
    });
  }, 0);
}
function copyReport() {
  navigator.clipboard.writeText(
    document.getElementById("reportText").textContent,
  );
  toast("Report copied");
}
function downloadMainReportPdf() {
  const pdf = analysisPdfDocument(`${EXAMS[state.currentExam]} - Class Result Report`);
  if (!pdf) return;
  const results = state.students.map((student) => ({ student, result: calcStudent(student, state.currentExam) }));
  const ranked = [...results].sort((a, b) => b.result.pct - a.result.pct);
  const average = results.reduce((sum, item) => sum + item.result.pct, 0) / results.length;
  const passCount = results.filter((item) => item.result.allPass).length;
  const theoryMaximum = state.level === "secondary" ? 75 : 50;
  const subjectStats = state.subjects.map((subject, index) => {
    const marks = state.students.map((student) => state.marks[key(state.currentExam, student.roll)]?.[index]).filter(Boolean);
    const averageTheory = marks.length ? marks.reduce((sum, mark) => sum + (+mark.t || 0), 0) / marks.length : 0;
    const passing = marks.filter((mark) => subjectPass(mark)).length;
    return [subject, `${averageTheory.toFixed(2)}/${theoryMaximum}`, passing, marks.length - passing];
  });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Students: ${state.students.length}    Average: ${average.toFixed(2)}%    Passed: ${passCount}    NG: ${state.students.length - passCount}`, 10, 21);
  addAnalysisChart(pdf, "reportSubjectChart", 10, 27, 135, 65);
  addAnalysisChart(pdf, "reportOutcomeChart", 160, 27, 110, 65);
  pdf.autoTable({ startY: 99, head: [["Subject", "Theory Average", "Passed", "NG"]], body: subjectStats, theme: "grid", styles: { fontSize: 8, cellPadding: 2.5 }, headStyles: { fillColor: [35, 57, 91] } });
  pdf.autoTable({ startY: pdf.lastAutoTable.finalY + 8, head: [["Roll", "Name", "Total", "Percentage", "GPA", "Position", "Result"]], body: ranked.slice(0, 10).map((item, index) => [item.student.roll, item.student.name, `${item.result.total}/${item.result.max}`, `${item.result.pct.toFixed(2)}%`, item.result.gpa, index + 1, item.result.allPass ? "PASS" : "NG"]), theme: "grid", styles: { fontSize: 8, cellPadding: 2.5 }, headStyles: { fillColor: [35, 57, 91] } });
  pdf.save(`markviz-${EXAMS[state.currentExam].replaceAll(" ", "-").toLowerCase()}-class-report.pdf`);
}
function testSettingsPage(c) {
  c.innerHTML = `<div class="card"><div class="section-title"><h2>Test Exam Settings</h2><button class="btn primary" onclick="saveTestSettings()">Save Test Settings</button></div><p class="muted">Configure the subjects and marks used only by the Test Exam.</p><div class="form-grid"><div class="field"><label for="testFullMarks">Full marks per subject</label><input id="testFullMarks" type="number" min="1" step="1" value="${state.testFullMarks}"></div><div class="field"><label for="testPassMarks">Pass marks per subject</label><input id="testPassMarks" type="number" min="0" step="1" value="${state.testPassMarks}"></div></div></div>
 <div class="section-title"><h2>Test Exam Subjects</h2><button class="btn secondary" onclick="addTestSubject()">+ Add Subject</button></div><div class="card"><div class="subject-list">${state.testSubjects.map((subject, i) => `<div class="subject-row"><b>${i + 1}</b><input id="testSub${i}" value="${subject.replaceAll('"', '&quot;')}"><button class="btn danger icon-btn" type="button" title="Remove ${subject}" aria-label="Remove ${subject}" onclick="removeTestSubject(${i})">×</button></div>`).join("")}</div></div>`;
}
function saveTestSettings() {
  const fullMarks = Number(document.getElementById("testFullMarks").value);
  const passMarks = Number(document.getElementById("testPassMarks").value);
  if (!Number.isFinite(fullMarks) || fullMarks <= 0)
    return toast("Full marks must be greater than zero");
  if (!Number.isFinite(passMarks) || passMarks < 0 || passMarks > fullMarks)
    return toast("Pass marks must be between zero and full marks");
  const oldSubjects = [...state.testSubjects];
  const subjects = state.testSubjects.map(
    (_, i) => document.getElementById(`testSub${i}`).value.trim() || `Subject ${i + 1}`,
  );
  remapTestMarks(oldSubjects, subjects);
  state.testSubjects = subjects;
  state.testFullMarks = fullMarks;
  state.testPassMarks = passMarks;
  save();
  render();
  toast("Test Exam settings saved");
}
function addTestSubject() {
  state.testSubjects.push(`Subject ${state.testSubjects.length + 1}`);
  render();
  document.getElementById(`testSub${state.testSubjects.length - 1}`).focus();
}
function removeTestSubject(index) {
  if (state.testSubjects.length === 1) return toast("Keep at least one Test Exam subject");
  const subject = state.testSubjects[index];
  if (!confirm(`Remove ${subject}? Existing Test Exam marks for this subject will be removed.`)) return;
  const oldSubjects = [...state.testSubjects];
  state.testSubjects.splice(index, 1);
  remapTestMarks(oldSubjects, state.testSubjects);
  save();
  render();
}
function remapTestMarks(oldSubjects, newSubjects) {
  Object.keys(state.testMarks).forEach((recordKey) => {
    const oldMarks = state.testMarks[recordKey] || [];
    const used = new Set();
    state.testMarks[recordKey] = newSubjects.map((subject, newIndex) => {
      let oldIndex = oldSubjects.findIndex(
        (oldSubject, index) => oldSubject === subject && !used.has(index),
      );
      if (oldIndex < 0 && newIndex < oldMarks.length && !used.has(newIndex)) {
        oldIndex = newIndex;
      }
      if (oldIndex < 0) return {};
      used.add(oldIndex);
      return oldMarks[oldIndex] || {};
    });
  });
}
function settingsPage(c) {
  c.innerHTML = `<div class="card"><div class="section-title"><h2>${state.level === "secondary" ? "Secondary" : "Primary"} Subject Settings</h2><div class="toolbar"><button class="btn secondary" onclick="addSubject()">+ Add Subject</button><button class="btn primary" onclick="saveSubjects()">Save Subjects</button></div></div><p class="muted">Add, rename, or remove subjects for the selected level. The ledger updates after saving.</p><div class="subject-list">${state.subjects.map((s, i) => `<div class="subject-row"><b>${i + 1}</b><input id="sub${i}" value="${s.replaceAll('"', '&quot;')}"><button class="btn danger icon-btn" type="button" title="Remove ${s}" aria-label="Remove ${s}" onclick="removeSubject(${i})">×</button></div>`).join("")}</div></div>
 <div class="section-title"><h2>Level Settings</h2></div><div class="card"><div class="field"><label for="settingsLevelSelect">Level</label><select id="settingsLevelSelect" onchange="setLevel(this.value)"><option value="primary" ${state.level === "primary" ? "selected" : ""}>Primary Level</option><option value="secondary" ${state.level === "secondary" ? "selected" : ""}>Secondary Level</option></select></div></div>
 <div class="section-title"><h2>Data Management</h2></div><div class="card"><button class="btn danger" onclick="clearAllData()">Clear All Data</button><p class="muted">This permanently removes registered students, marks, subjects, and saved settings.</p></div>
 <div class="section-title"><h2>Grading Rules</h2></div><div class="card"><p class="muted">${state.level === "secondary" ? "Secondary grading: 90 and above A+, 80–89 A, 70–79 B+, 60–69 B, 50–59 C+, 40–49 C, 35–39 D, below 35 NG (Non-Grade)." : "Component grading is calculated independently: 45–50 A+, 40–44 A, 35–39 B+, 30–34 B, 25–29 C+, 20–24 C, 18–19 D+, below 18 NG (Non-Grade)."}</p><p class="muted">Pass requires Theory ≥ ${state.level === "secondary" ? 27 : 18} and Practical ≥ ${state.level === "secondary" ? 10 : 18} in every subject.</p></div>`;
}
function saveSubjects() {
  const oldSubjects = [...state.subjects];
  const subjects = state.subjects.map(
    (_, i) =>
      document.getElementById("sub" + i).value.trim() || `Subject ${i + 1}`,
  );
  remapMarks(oldSubjects, subjects);
  if (state.level === "secondary") state.secondarySubjects = subjects;
  else state.primarySubjects = subjects;
  state.subjects = subjects;
  save();
  render();
  toast("Subjects saved");
}
function addSubject() {
  state.subjects.push(`Subject ${state.subjects.length + 1}`);
  if (state.level === "secondary") state.secondarySubjects = state.subjects;
  else state.primarySubjects = state.subjects;
  save();
  render();
  document.getElementById(`sub${state.subjects.length - 1}`).focus();
}
function removeSubject(index) {
  if (state.subjects.length === 1) return toast("Keep at least one subject");
  const subject = state.subjects[index];
  if (!confirm(`Remove ${subject}? Existing marks for this subject will be removed.`)) return;
  state.subjects.splice(index, 1);
  if (state.level === "secondary") state.secondarySubjects = state.subjects;
  else state.primarySubjects = state.subjects;
  save();
  render();
}
function remapMarks(oldSubjects, newSubjects) {
  const remap = (records) => {
    Object.keys(records).forEach((recordKey) => {
      const oldMarks = records[recordKey] || [];
      const used = new Set();
      records[recordKey] = newSubjects.map((subject, newIndex) => {
        let oldIndex = oldSubjects.findIndex(
          (oldSubject, index) => oldSubject === subject && !used.has(index),
        );
        if (oldIndex < 0 && newIndex < oldMarks.length && !used.has(newIndex)) {
          oldIndex = newIndex;
        }
        if (oldIndex < 0) return {};
        used.add(oldIndex);
        return oldMarks[oldIndex] || {};
      });
    });
  };
  remap(state.marks);
  remap(state.testMarks);
}
function setLevel(level) {
  state.level = level === "secondary" ? "secondary" : "primary";
  state.subjects = state.level === "secondary" ? state.secondarySubjects : state.primarySubjects;
  save();
  render();
  toast(`${state.level === "secondary" ? "Secondary" : "Primary"} Level selected`);
}
function clearAllData() {
  if (!confirm("Clear all saved data? This cannot be undone.")) return;
  if (!confirm("Are you sure? Delete all students, marks, subjects, and settings?")) return;
  localStorage.removeItem(workspaceStorageKey);
  fetch("/api/workspace", { method: "DELETE", credentials: "same-origin" }).catch(() => {});
  state.students = [];
  state.level = "primary";
  state.primarySubjects = [...defaultSubjects];
  state.secondarySubjects = [...secondarySubjects];
  state.subjects = [...defaultSubjects];
  state.testSubjects = [...defaultSubjects];
  state.testFullMarks = 20;
  state.testPassMarks = 8;
  state.marks = {};
  state.testMarks = {};
  state.completedExams = [];
  state.currentExam = 0;
  state.page = "dashboard";
  render();
  toast("All data cleared");
}
function selectExam(i) {
  if (!examUnlocked(i)) return toast(`Complete ${EXAMS[i - 1]} before opening ${EXAMS[i]}`);
  state.currentExam = i;
  document.getElementById("examSelect").value = i;
  save();
  render();
}
document.getElementById("nav").addEventListener("click", (e) => {
  const toggle = e.target.closest(".nav-dropdown-toggle");
  if (toggle) {
    const menu = document.getElementById(toggle.getAttribute("aria-controls"));
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    menu.hidden = isOpen;
    return;
  }
  const b = e.target.closest(".nav-item");
  if (!b) return;
  state.page = b.dataset.page;
  document.body.classList.remove("mobile-nav-open");
  document.getElementById("mobileNavToggle").setAttribute("aria-expanded", "false");
  document.getElementById("mobileNavToggle").setAttribute("aria-label", "Show dashboard navigation");
  document.getElementById("mobileNavToggle").setAttribute("title", "Show dashboard navigation");
  document.querySelector("#mobileNavToggle span").textContent = "☰";
  const menu = document.getElementById("testExamMenu");
  const isTestExamPage =
    state.page === "testMarks" ||
    state.page === "testLedger" ||
    state.page === "testReport";
  menu.hidden = !isTestExamPage;
  document
    .querySelector(".nav-dropdown-toggle")
    .setAttribute("aria-expanded", String(isTestExamPage));
  render();
});
document.addEventListener("click", (e) => {
  if (
    document.body.classList.contains("mobile-nav-open") &&
    !e.target.closest(".sidebar") &&
    !e.target.closest("#mobileNavToggle")
  ) {
    document.body.classList.remove("mobile-nav-open");
    document.getElementById("mobileNavToggle").setAttribute("aria-expanded", "false");
    document.getElementById("mobileNavToggle").setAttribute("aria-label", "Show dashboard navigation");
    document.getElementById("mobileNavToggle").setAttribute("title", "Show dashboard navigation");
    document.querySelector("#mobileNavToggle span").textContent = "☰";
  }
  if (e.target.closest(".nav-dropdown")) return;
  const toggle = document.querySelector(".nav-dropdown-toggle");
  const menu = document.getElementById("testExamMenu");
  menu.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const toggle = document.querySelector(".nav-dropdown-toggle");
  const menu = document.getElementById("testExamMenu");
  menu.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
});
document
  .getElementById("examSelect")
  .addEventListener("change", (e) => selectExam(+e.target.value));
document.getElementById("logoutBtn").addEventListener("click", async () => {
  if (
    !confirm(
      "Log out and return to the landing page? Your saved data will remain.",
    )
  )
    return;
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  window.location.href = "/";
});
document.getElementById("sidebarToggle").addEventListener("click", (e) => {
  const collapsed = document.body.classList.toggle("sidebar-collapsed");
  e.currentTarget.textContent = collapsed ? "›" : "‹";
  e.currentTarget.setAttribute(
    "aria-label",
    collapsed ? "Show dashboard navigation" : "Hide dashboard navigation",
  );
  e.currentTarget.setAttribute(
    "title",
    collapsed ? "Show dashboard navigation" : "Hide dashboard navigation",
  );
});
document.getElementById("mobileNavToggle").addEventListener("click", (e) => {
  const isOpen = document.body.classList.toggle("mobile-nav-open");
  e.currentTarget.setAttribute("aria-expanded", String(isOpen));
  e.currentTarget.setAttribute(
    "aria-label",
    isOpen ? "Hide dashboard navigation" : "Show dashboard navigation",
  );
  e.currentTarget.setAttribute(
    "title",
    isOpen ? "Hide dashboard navigation" : "Show dashboard navigation",
  );
  e.currentTarget.querySelector("span").textContent = isOpen ? "×" : "☰";
});
async function startDashboard() {
  try {
    const response = await fetch("/api/auth/session", { credentials: "same-origin" });
    if (!response.ok) throw new Error("Not authenticated");
    const session = await response.json();
    setWorkspaceStorageKey(session.user.email);
    await load();
    render();
  } catch (error) {
    window.location.replace("/login");
  }
}
startDashboard();
