"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE = {
  todos: "noirTodos",
  money: "noirMoney",
  attendance: "noirSubjects",
  savings: "noirSavings"
};

const SAVING_AMOUNTS = [1, 10, 50, 100, 500, 1000, 5000, 10000];

let todos = loadData(STORAGE.todos);
let money = loadData(STORAGE.money);
let subjects = loadData(STORAGE.attendance);
let savings = loadData(STORAGE.savings);

let currentView = "homeView";
let currentFilter = "all";
let savingMode = null;
let selectedSavingId = null;

function loadData(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("データの読み込みに失敗しました:", error);
    return [];
  }
}

function makeId(prefix) {
  return prefix + "-" + Date.now() + "-" +
    Math.random().toString(36).slice(2, 9);
}

function saveData() {
  try {
    localStorage.setItem(STORAGE.todos, JSON.stringify(todos));
    localStorage.setItem(STORAGE.money, JSON.stringify(money));
    localStorage.setItem(STORAGE.attendance, JSON.stringify(subjects));
    localStorage.setItem(STORAGE.savings, JSON.stringify(savings));
    return true;
  } catch (error) {
    console.error("データを保存できませんでした:", error);
    showToast("保存に失敗しました。空き容量を確認してください");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function yen(value) {
  return "\u00A5" +
    Math.round(Number(value) || 0).toLocaleString("ja-JP");
}

function todayString() {
  const date = new Date();
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return localDate.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "期限なし";

  const parts = String(value).split("-");
  if (parts.length !== 3) return String(value);

  return Number(parts[1]) + "/" + Number(parts[2]);
}

function isThisMonth(value) {
  return Boolean(value) &&
    String(value).slice(0, 7) === todayString().slice(0, 7);
}

function todoTitle(item) {
  return item.title ?? item.name ?? item.task ?? "名称未設定";
}

function moneyTitle(item) {
  return item.title ?? item.name ?? item.description ?? "名称未設定";
}

function moneyAmount(item) {
  return Math.abs(Number(item.amount ?? item.price ?? item.value ?? 0));
}

function subjectTitle(item) {
  return item.title ?? item.name ?? item.subject ?? "名称未設定";
}

function subjectLimit(item) {
  return Math.max(0, Number(item.limit ?? item.maxAbsences ?? item.max ?? 0));
}

function subjectAbsences(item) {
  return Math.max(
    0,
    Number(item.absences ?? item.absenceCount ?? item.count ?? 0)
  );
}

function isIncome(item) {
  const kind = String(
    item.kind ?? item.type ?? item.category ?? ""
  ).toLowerCase();

  return kind === "income" ||
    kind.includes("収入") ||
    kind.includes("給料") ||
    kind.includes("給与");
}

/* 既存データの形式を引き継ぐ */

function normalizeData() {
  todos = todos.map((item, index) => ({
    ...item,
    id: item.id ?? "todo-" + index,
    title: todoTitle(item),
    dueDate: item.dueDate ?? item.date ?? "",
    priority: item.priority ?? "normal",
    completed: Boolean(item.completed ?? item.done)
  }));

  money = money.map((item, index) => {
    const oldType = String(item.kind ?? item.type ?? "").toLowerCase();
    let kind = isIncome(item) ? "income" : "expense";

    if (oldType === "expense" || oldType.includes("支出")) {
      kind = "expense";
    }

    return {
      ...item,
      id: item.id ?? "money-" + index,
      title: moneyTitle(item),
      amount: moneyAmount(item),
      kind,
      date: item.date ?? item.createdAt ?? todayString(),
      category: item.category ?? "その他"
    };
  });

  subjects = subjects.map((item, index) => ({
    ...item,
    id: item.id ?? "subject-" + index,
    title: subjectTitle(item),
    limit: subjectLimit(item),
    absences: subjectAbsences(item)
  }));

  savings = savings.map((item, index) => ({
    ...item,
    id: item.id ?? "saving-" + index,
    title: item.title ?? item.name ?? "貯金目標",
    goal: Math.max(0, Number(item.goal ?? item.target ?? 0)),
    saved: Math.max(0, Number(item.saved ?? item.total ?? item.amount ?? 0)),
    deadline: item.deadline ?? item.dueDate ?? ""
  }));

  saveData();
}

/* 通知 */

function showToast(message) {
  const toast = $("#toast");

  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2300);
}

/* 画面切り替え */

function showView(viewId) {
  if (!$("#" + viewId)) {
    console.error("画面が見つかりません:", viewId);
    return;
  }

  currentView = viewId;

  $$(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });

  $$(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });

  const addButton = $("#addButton");

  if (addButton) {
    addButton.style.display = viewId === "homeView" ? "none" : "flex";
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
  renderAll();
}

/* 追加モーダル */

function setAddType(type) {
  $$(".add-type").forEach((button) => {
    button.classList.toggle("active", button.dataset.type === type);
  });

  $$(".entry-form").forEach((form) => {
    form.classList.toggle("hidden", form.id !== type + "Form");
  });

  const titles = {
    todo: "ToDoを追加",
    money: "お金を記録",
    attendance: "科目を追加",
    savings: "貯金目標を追加"
  };

  if ($("#modalTitle")) {
    $("#modalTitle").textContent = titles[type] || "新しく追加";
  }
}

function openModal(type = null) {
  const typeForView = {
    todoView: "todo",
    moneyView: "money",
    attendanceView: "attendanceView" === currentView
      ? "attendance"
      : "todo"
  };

  const chosenType = type || typeForView[currentView] || "todo";
  const backdrop = $("#modalBackdrop");

  if (!backdrop) {
    showToast("追加画面が見つかりません");
    return;
  }

  setAddType(chosenType);
  backdrop.classList.remove("hidden");

  const form = $("#" + chosenType + "Form");

  if (form) {
    const dateInput = form.querySelector('input[type="date"]');

    if (dateInput && !dateInput.value) {
      dateInput.value = todayString();
    }

    const titleInput = form.querySelector('input[name="title"]');

    if (titleInput) {
      setTimeout(() => titleInput.focus(), 100);
    }
  }
}

function closeModal() {
  $("#modalBackdrop")?.classList.add("hidden");
}

/* ホーム */

function renderHome() {
  const unfinished = todos.filter((item) => !item.completed);

  const income = money
    .filter((item) => isThisMonth(item.date) && item.kind === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expense = money
    .filter((item) => isThisMonth(item.date) && item.kind === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  if ($("#homeTodoCount")) {
    $("#homeTodoCount").textContent = unfinished.length;
  }

  if ($("#homeBalance")) {
    $("#homeBalance").textContent = yen(income - expense);
  }

  if ($("#homeMoneyDetail")) {
    $("#homeMoneyDetail").textContent =
      "収入 " + yen(income) + " ・ 支出 " + yen(expense);
  }

  if ($("#homeAttendanceCount")) {
    $("#homeAttendanceCount").innerHTML =
      subjects.length + '<span class="unit">科目</span>';
  }

  const warnings = subjects.filter((item) => {
    const limit = subjectLimit(item);
    return limit > 0 && subjectAbsences(item) >= limit;
  }).length;

  if ($("#homeAttendanceDetail")) {
    $("#homeAttendanceDetail").textContent = warnings
      ? "欠席上限に達した科目：" + warnings
      : "欠席状況をチェック";
  }

  const nextTodo = unfinished
    .filter((item) => item.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  if ($("#homeNextTodo")) {
    $("#homeNextTodo").textContent = nextTodo
      ? "次の期限：" + todoTitle(nextTodo) +
        "（" + formatDate(nextTodo.dueDate) + "）"
      : unfinished.length
        ? "期限を設定して管理しよう"
        : "タスクはありません";
  }

  const preview = unfinished
    .slice()
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 3);

  if ($("#homeTodoList")) {
    $("#homeTodoList").innerHTML = preview.length
      ? preview.map((item) => `
          <article class="list-card">
            <button
              type="button"
              class="check-button"
              data-action="toggle-todo"
              data-id="${escapeHTML(item.id)}"
              aria-label="完了にする"
            ></button>

            <div class="list-card-main">
              <div class="list-card-title">${escapeHTML(item.title)}</div>
              <div class="list-card-meta">
                ${item.dueDate ? "期限 " + formatDate(item.dueDate) : "期限なし"}
              </div>
            </div>

            ${
              item.priority === "high"
                ? '<span class="priority high">優先</span>'
                : ""
            }
          </article>
        `).join("")
      : '<div class="empty-state visible">未完了のタスクはありません。</div>';
  }
}

/* 欠席管理 */
function renderAttendance() {
  const totalAbsences = subjects.reduce(
    (sum, item) => sum + subjectAbsences(item), 0
  );

  const warnings = subjects.filter((item) => {
    const limit = subjectLimit(item);
    return limit > 0 && subjectAbsences(item) >= limit;
  }).length;

  if ($("#attendanceStats")) {
    $("#attendanceStats").innerHTML = `
      <div class="stat-box">
        <span>登録科目</span><strong>${subjects.length}</strong>
      </div>
      <div class="stat-box">
        <span>欠席合計</span><strong>${totalAbsences}</strong>
      </div>
      <div class="stat-box">
        <span>上限到達</span><strong>${warnings}</strong>
      </div>
    `;
  }

  if ($("#attendanceEmpty")) {
    $("#attendanceEmpty").classList.toggle("visible", subjects.length === 0);
  }

  if ($("#attendanceList")) {
    $("#attendanceList").innerHTML = subjects.map((item) => {
      const limit = subjectLimit(item);
      const absences = subjectAbsences(item);
      const left = Math.max(0, limit - absences);
      const percent = limit > 0 ? Math.min(100, absences / limit * 100) : 0;
      const warning = limit > 0 && absences >= limit;
      const nearLimit = limit > 0 && absences >= limit * 0.8 && !warning;

      return `
        <article class="list-card">
          <div class="list-card-main">
            <div class="list-card-title">${escapeHTML(item.title)}</div>
            <div class="list-card-meta">
              欠席 ${absences}回 / 上限 ${limit}回
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${percent}%"></div>
            </div>
            <span class="status-tag ${
              warning || nearLimit ? "warning" : "safe"
            }">
              ${
                warning
                  ? "上限到達"
                  : nearLimit
                    ? "上限に注意"
                    : "あと" + left + "回欠席可能"
              }
            </span>
          </div>
          <div class="card-actions">
            <button class="icon-button"
              data-action="decrease-absence"
              data-id="${escapeHTML(item.id)}"
              aria-label="欠席数を減らす">-</button>
            <button class="icon-button"
              data-action="increase-absence"
              data-id="${escapeHTML(item.id)}"
              aria-label="欠席数を増やす">＋</button>
            <button class="icon-button delete"
              data-action="delete-subject"
              data-id="${escapeHTML(item.id)}"
              aria-label="削除">×</button>
          </div>
        </article>
      `;
    }).join("");
  }
}

/* お金管理 */

function renderMoney() {
  const monthMoney = money.filter((item) => isThisMonth(item.date));

  const income = monthMoney
    .filter((item) => item.kind === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expense = monthMoney
    .filter((item) => item.kind === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  if ($("#monthBalance")) $("#monthBalance").textContent = yen(income - expense);
  if ($("#monthIncome")) $("#monthIncome").textContent = yen(income);
  if ($("#monthExpense")) $("#monthExpense").textContent = yen(expense);

  if ($("#moneyEmpty")) {
    $("#moneyEmpty").classList.toggle("visible", money.length === 0);
  }

  if ($("#moneyList")) {
    $("#moneyList").innerHTML = money
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map((item) => `
        <article class="list-card">
          <div class="list-card-main">
            <div class="list-card-title">${escapeHTML(item.title)}</div>
            <div class="list-card-meta">
              ${formatDate(item.date)} ・ ${escapeHTML(item.category || "その他")}
            </div>
          </div>
          <div class="list-card-side">
            <strong style="color:${
              item.kind === "income" ? "var(--success)" : "var(--text)"
            }">
              ${item.kind === "income" ? "+" : "-"}${yen(item.amount)}
            </strong>
            <small>${item.kind === "income" ? "収入" : "支出"}</small>
          </div>
          <button class="icon-button delete"
            data-action="delete-money"
            data-id="${escapeHTML(item.id)}"
            aria-label="削除">×</button>
        </article>
      `).join("");
  }

  renderSavings();
}

/* 貯金の集計 */

function totalSaved() {
  return savings.reduce(
    (sum, item) => sum + Math.max(0, Number(item.saved) || 0),
    0
  );
}

/* 期限までの毎月の必要貯金額 */

function getMonthlySavingPlan(item) {
  const goal = Math.max(0, Number(item.goal) || 0);
  const saved = Math.max(0, Number(item.saved) || 0);
  const remaining = Math.max(0, goal - saved);

  if (remaining === 0) {
    return {
      type: "complete",
      amount: 0,
      message: "この目標は達成済みです"
    };
  }

  if (!item.deadline) {
    return {
      type: "normal",
      amount: null,
      message: "期限を設定すると必要な月額がわかります"
    };
  }

  const today = todayString();

  if (item.deadline < today) {
    return {
      type: "overdue",
      amount: null,
      message: "設定した期限を過ぎています。期限を変更してください"
    };
  }

  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const [endYear, endMonth, endDay] = item.deadline.split("-").map(Number);

  if (
    !todayYear || !todayMonth || !todayDay ||
    !endYear || !endMonth || !endDay
  ) {
    return {
      type: "normal",
      amount: null,
      message: "期限を確認してください"
    };
  }

  let months =
    (endYear - todayYear) * 12 + (endMonth - todayMonth);

  if (endDay > todayDay) {
    months += 1;
  }

  months = Math.max(1, months);

  return {
    type: "normal",
    amount: Math.ceil(remaining / months),
    message: "残り " + months + "か月で達成する場合"
  };
}

/* 貯金目標一覧 */

function renderSavings() {
  if (!savings.some((item) =>
    String(item.id) === String(selectedSavingId)
  )) {
    selectedSavingId = savings[0]?.id ?? null;
  }

  const list = $("#savingsList");
  const empty = $("#savingsEmpty");

  if (empty) {
    empty.classList.toggle("visible", savings.length === 0);
  }

  if (!list) return;

  list.innerHTML = savings.map((item) => {
    const itemGoal = Math.max(0, Number(item.goal) || 0);
    const itemSaved = Math.max(0, Number(item.saved) || 0);
    const left = Math.max(0, itemGoal - itemSaved);

    const percent = itemGoal > 0
      ? Math.min(100, itemSaved / itemGoal * 100)
      : 0;

    const selected = String(item.id) === String(selectedSavingId);
    const plan = getMonthlySavingPlan(item);
    const modeOpen = selected && savingMode !== null;

    let planHTML = "";

    if (plan.type === "complete") {
      planHTML = `
        <div class="savings-monthly-plan is-complete">
          <span class="savings-monthly-plan-label">毎月の必要貯金額</span>
          <strong>目標達成！</strong>
          <p>${plan.message}</p>
        </div>
      `;
    } else if (plan.type === "overdue") {
      planHTML = `
        <div class="savings-monthly-plan is-overdue">
          <span class="savings-monthly-plan-label">毎月の必要貯金額</span>
          <strong>期限を過ぎています</strong>
          <p>${plan.message}</p>
        </div>
      `;
    } else if (plan.amount !== null) {
      planHTML = `
        <div class="savings-monthly-plan">
          <span class="savings-monthly-plan-label">毎月の必要貯金額</span>
          <strong>${yen(plan.amount)}<span class="unit">/月</span></strong>
          <p>${plan.message}（目標まで ${yen(left)}）</p>
        </div>
      `;
    } else {
      planHTML = `
        <div class="savings-monthly-plan">
          <span class="savings-monthly-plan-label">毎月の必要貯金額</span>
          <strong>期限未設定</strong>
          <p>${plan.message}</p>
        </div>
      `;
    }

    const amountsHTML = modeOpen ? `
      <div class="saving-quick-panel">
        <p class="saving-quick-title">
          ${savingMode === "deposit" ? "いくら貯金する？" : "いくら使う？"}
        </p>
        <div class="saving-amount-grid">
          ${SAVING_AMOUNTS.map((amount) => {
            const disabled = savingMode === "spend" && amount > itemSaved;

            return `
              <button type="button"
                class="saving-amount-button"
                data-saving-amount="${amount}"
                data-id="${escapeHTML(item.id)}"
                ${disabled ? "disabled" : ""}>
                ${savingMode === "deposit" ? "+" : "-"}${amount.toLocaleString("ja-JP")}円
              </button>
            `;
          }).join("")}
        </div>
      </div>
    ` : "";

    return `
      <article class="list-card savings-card ${selected ? "selected" : ""}">
        <div class="list-card-main">
          <div class="list-card-title">${escapeHTML(item.title)}</div>

          <div class="list-card-meta">
            現在 ${yen(itemSaved)} / 目標 ${yen(itemGoal)}
          </div>

          <div class="list-card-meta">
            ${item.deadline
              ? "達成期限 " + formatDate(item.deadline)
              : "達成期限 未設定"}
          </div>

          <div class="progress-track">
            <div class="progress-fill" style="width:${percent}%"></div>
          </div>

          <div class="savings-progress-label">
            <span>${percent >= 100 ? "目標達成" : "達成率 " + Math.round(percent) + "%"}</span>
            <strong>${percent >= 100 ? "100%" : yen(left) + " 残り"}</strong>
          </div>

          ${planHTML}

          <div class="savings-actions">
            <button type="button"
              class="savings-mode-button ${selected && savingMode === "deposit" ? "active" : ""}"
              data-saving-mode="deposit"
              data-id="${escapeHTML(item.id)}"
              aria-expanded="${selected && savingMode === "deposit"}">
              <span class="button-symbol">＋</span> 貯金
            </button>

            <button type="button"
              class="savings-mode-button ${selected && savingMode === "spend" ? "active" : ""}"
              data-saving-mode="spend"
              data-id="${escapeHTML(item.id)}"
              aria-expanded="${selected && savingMode === "spend"}">
              <span class="button-symbol">-</span> 使う
            </button>
          </div>

          ${amountsHTML}

          <div class="card-actions">
            <button type="button" class="icon-button"
              data-action="edit-saving"
              data-id="${escapeHTML(item.id)}">
              編集
            </button>
            <button type="button" class="icon-button delete"
              data-action="delete-saving"
              data-id="${escapeHTML(item.id)}"
              aria-label="貯金目標を削除">削除</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/* ToDo一覧 */

function renderTodos() {
  let filtered = todos.slice();

  if (currentFilter === "active") {
    filtered = filtered.filter((item) => !item.completed);
  }

  if (currentFilter === "done") {
    filtered = filtered.filter((item) => item.completed);
  }

  filtered.sort((a, b) => {
    if (a.completed !== b.completed) {
      return Number(a.completed) - Number(b.completed);
    }

    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;

    return a.dueDate.localeCompare(b.dueDate);
  });

  if ($("#todoEmpty")) {
    $("#todoEmpty").classList.toggle("visible", filtered.length === 0);
  }

  if ($("#todoList")) {
    $("#todoList").innerHTML = filtered.map((item) => `
      <article class="list-card">
        <button class="check-button ${item.completed ? "checked" : ""}"
          data-action="toggle-todo"
          data-id="${escapeHTML(item.id)}"
          aria-label="完了状態を切り替える">
          ${item.completed ? "&#10003;" : ""}
        </button>

        <div class="list-card-main">
          <div class="list-card-title" style="${
            item.completed
              ? "text-decoration:line-through;color:var(--muted)"
              : ""
          }">${escapeHTML(item.title)}</div>

          <div class="list-card-meta">${
            item.dueDate ? "期限 " + formatDate(item.dueDate) : "期限なし"
          }</div>

          ${
            item.priority === "high"
              ? '<span class="priority high">優先度：高</span>'
              : item.priority === "low"
                ? '<span class="priority">優先度：低</span>'
                : ""
          }
        </div>

        <button class="icon-button delete"
          data-action="delete-todo"
          data-id="${escapeHTML(item.id)}"
          aria-label="削除">×</button>
      </article>
    `).join("");
  }
}

function renderAll() {
  renderHome();
  renderAttendance();
  renderMoney();
  renderTodos();
}

/* ToDo追加 */

function addTodo(form) {
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();

  if (!title) {
    showToast("ToDoの内容を入力してね");
    return;
  }

  todos.unshift({
    id: makeId("todo"),
    title,
    dueDate: String(data.get("dueDate") || ""),
    priority: String(data.get("priority") || "normal"),
    completed: false,
    createdAt: todayString()
  });

  if (!saveData()) {
    todos.shift();
    return;
  }

  form.reset();
  closeModal();
  renderAll();
  showToast("ToDoを追加しました");
}
/* お金の記録追加 */

function addMoney(form) {
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  const amount = Number(data.get("amount"));

  if (!title || !Number.isFinite(amount) || amount <= 0) {
    showToast("内容と金額を確認してね");
    return;
  }

  const item = {
    id: makeId("money"),
    kind: String(data.get("kind") || "expense"),
    title,
    amount: Math.round(amount),
    date: String(data.get("date") || todayString()),
    category: String(data.get("category") || "その他"),
    createdAt: todayString()
  };

  money.unshift(item);

  if (!saveData()) {
    money.shift();
    return;
  }

  form.reset();
  closeModal();
  renderAll();
  showToast("お金を記録しました");
}

/* 科目追加 */

function addSubject(form) {
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  const limit = Number(data.get("limit"));
  const absences = Number(data.get("absences") || 0);

  if (
    !title ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    !Number.isInteger(absences) ||
    absences < 0
  ) {
    showToast("科目名・欠席上限・欠席数を確認してね");
    return;
  }

  const item = {
    id: makeId("subject"),
    title,
    limit,
    absences,
    createdAt: todayString()
  };

  subjects.unshift(item);

  if (!saveData()) {
    subjects.shift();
    return;
  }

  form.reset();
  closeModal();
  renderAll();
  showToast("科目を追加しました");
}

/* 貯金目標追加 */

function addSavings(form) {
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  const goal = Number(data.get("target") ?? data.get("goal"));
  const saved = Number(data.get("saved") || 0);
  const deadline = String(data.get("deadline") || "");

  if (
    !title ||
    !Number.isSafeInteger(goal) ||
    goal <= 0 ||
    !Number.isSafeInteger(saved) ||
    saved < 0
  ) {
    showToast("貯金名・目標金額・貯金額を確認してね");
    return;
  }

  const newSaving = {
    id: makeId("saving"),
    title,
    goal,
    saved,
    deadline,
    createdAt: todayString()
  };

  savings.unshift(newSaving);
  selectedSavingId = newSaving.id;
  savingMode = null;

  if (!saveData()) {
    savings.shift();
    selectedSavingId = savings[0]?.id ?? null;
    return;
  }

  form.reset();
  closeModal();
  renderAll();
  showToast("貯金目標を追加しました");
}

/* 貯金・使う */

function changeSavingAmount(id, amount, mode) {
  const saving = savings.find(
    (item) => String(item.id) === String(id)
  );

  if (!saving) {
    showToast("貯金目標が見つかりません");
    return;
  }

  const value = Number(amount);

  if (!Number.isSafeInteger(value) || value <= 0) {
    showToast("金額を確認してね");
    return;
  }

  if (mode !== "deposit" && mode !== "spend") {
    showToast("貯金または使うを選んでね");
    return;
  }

  const current = Math.max(0, Number(saving.saved) || 0);

  if (mode === "spend" && value > current) {
    showToast("現在の貯金額を超えて使うことはできません");
    return;
  }

  if (
    mode === "deposit" &&
    current + value > Number.MAX_SAFE_INTEGER
  ) {
    showToast("この金額は登録できません");
    return;
  }

  const previousSavings = savings;
  const previousMoney = money;

  savings = savings.map((item) => {
    if (String(item.id) !== String(id)) return item;

    return {
      ...item,
      saved: mode === "deposit" ? current + value : current - value
    };
  });

  if (mode === "deposit") {
    money.unshift({
      id: makeId("money"),
      kind: "expense",
      title: "貯金",
      amount: value,
      date: todayString(),
      category: "貯金",
      createdAt: todayString(),
      savingId: saving.id
    });
  }

  if (!saveData()) {
    savings = previousSavings;
    money = previousMoney;
    return;
  }

  savingMode = null;
  selectedSavingId = id;

  renderAll();

  showToast(
    mode === "deposit"
      ? yen(value) + "を貯金し、お金管理に支出を記録しました"
      : yen(value) + "を貯金から使いました"
  );
}

/* 編集 */

function editSaving(id) {
  const saving = savings.find(
    (item) => String(item.id) === String(id)
  );

  if (!saving) {
    showToast("貯金目標が見つかりません");
    return;
  }

  const form = $("#savingsForm");

  if (!form) {
    showToast("編集フォームが見つかりません");
    return;
  }

  setAddType("savings");
  $("#modalTitle").textContent = "貯金目標を編集";

  form.elements.namedItem("title").value = saving.title;
  form.elements.namedItem("target").value = saving.goal;
  form.elements.namedItem("saved").value = saving.saved;
  form.elements.namedItem("deadline").value = saving.deadline || "";

  form.dataset.editId = String(saving.id);
  $("#modalBackdrop").classList.remove("hidden");
}

/* 各ボタンの処理 */

function handleAction(action, id) {
  if (action === "toggle-todo") {
    todos = todos.map((item) =>
      String(item.id) === String(id)
        ? { ...item, completed: !item.completed }
        : item
    );

    saveData();
    renderAll();
    showToast("ToDoを更新しました");

  } else if (action === "delete-todo") {
    if (!confirm("このToDoを削除する？")) return;

    const previous = todos;
    todos = todos.filter((item) => String(item.id) !== String(id));

    if (!saveData()) {
      todos = previous;
      return;
    }

    renderAll();
    showToast("ToDoを削除しました");

  } else if (action === "delete-money") {
    if (!confirm("この記録を削除する？")) return;

    const previous = money;
    money = money.filter((item) => String(item.id) !== String(id));

    if (!saveData()) {
      money = previous;
      return;
    }

    renderAll();
    showToast("記録を削除しました");

  } else if (action === "delete-subject") {
    if (!confirm("この科目を削除する？")) return;

    const previous = subjects;
    subjects = subjects.filter((item) => String(item.id) !== String(id));

    if (!saveData()) {
      subjects = previous;
      return;
    }

    renderAll();
    showToast("科目を削除しました");

  } else if (
    action === "increase-absence" ||
    action === "decrease-absence"
  ) {
    const previous = subjects;

    subjects = subjects.map((item) => {
      if (String(item.id) !== String(id)) return item;

      return {
        ...item,
        absences: action === "increase-absence"
          ? subjectAbsences(item) + 1
          : Math.max(0, subjectAbsences(item) - 1)
      };
    });

    if (!saveData()) {
      subjects = previous;
      return;
    }

    renderAll();
    showToast("欠席数を更新しました");

  } else if (action === "delete-saving") {
    if (!confirm("この貯金目標を削除する？")) return;

    const previous = savings;
    savings = savings.filter((item) => String(item.id) !== String(id));

    if (String(selectedSavingId) === String(id)) {
      selectedSavingId = savings[0]?.id ?? null;
    }

    savingMode = null;

    if (!saveData()) {
      savings = previous;
      return;
    }

    renderAll();
    showToast("貯金目標を削除しました");

  } else if (action === "edit-saving") {
    editSaving(id);
  }
}

/* イベント設定 */

function bindEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const savingModeButton = target.closest("[data-saving-mode]");

    if (savingModeButton) {
      const id = savingModeButton.dataset.id;
      const nextMode = savingModeButton.dataset.savingMode;

      if (String(selectedSavingId) !== String(id)) {
        selectedSavingId = id;
        savingMode = nextMode;
      } else {
        savingMode = savingMode === nextMode ? null : nextMode;
      }

      renderSavings();
      return;
    }

    const savingAmountButton = target.closest("[data-saving-amount]");

    if (savingAmountButton) {
      changeSavingAmount(
        savingAmountButton.dataset.id,
        Number(savingAmountButton.dataset.savingAmount),
        savingMode
      );
      return;
    }

    const actionButton = target.closest("[data-action]");

    if (actionButton) {
      handleAction(
        actionButton.dataset.action,
        actionButton.dataset.id
      );
      return;
    }

    const filterButton = target.closest("[data-filter]");

    if (filterButton) {
      currentFilter = filterButton.dataset.filter;

      $$(".filter-button").forEach((button) => {
        button.classList.toggle("active", button === filterButton);
      });

      renderTodos();
      return;
    }

    const typeButton = target.closest(".add-type");

    if (typeButton) {
      setAddType(typeButton.dataset.type);
      return;
    }

    const viewButton = target.closest("[data-view]");

    if (viewButton) {
      showView(viewButton.dataset.view);
      return;
    }
  });

  $("#addButton")?.addEventListener("click", () => openModal());

  $("#closeModal")?.addEventListener("click", closeModal);

  $("#modalBackdrop")?.addEventListener("click", (event) => {
    if (event.target === $("#modalBackdrop")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  $("#todoForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    addTodo(event.currentTarget);
  });

  $("#moneyForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    addMoney(event.currentTarget);
  });

  $("#attendanceForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    addSubject(event.currentTarget);
  });

  $("#savingsForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const editId = form.dataset.editId;

    if (!editId) {
      addSavings(form);
      return;
    }

    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const goal = Number(data.get("target"));
    const saved = Number(data.get("saved") || 0);
    const deadline = String(data.get("deadline") || "");

    if (
      !title ||
      !Number.isSafeInteger(goal) ||
      goal <= 0 ||
      !Number.isSafeInteger(saved) ||
      saved < 0
    ) {
      showToast("入力内容を確認してね");
      return;
    }

    const previous = savings;

    savings = savings.map((item) =>
      String(item.id) === String(editId)
        ? { ...item, title, goal, saved, deadline }
        : item
    );

    if (!saveData()) {
      savings = previous;
      return;
    }

    delete form.dataset.editId;
    form.reset();
    closeModal();
    renderAll();
    showToast("貯金目標を更新しました");
  });

  $("#modalBackdrop")?.addEventListener("transitionend", () => {
    // モーダルのアニメーション終了時に追加処理は不要
  });
}

/* 起動 */

function init() {
  normalizeData();

  const todayLabel = $("#todayLabel");

  if (todayLabel) {
    todayLabel.textContent = new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long"
    }).toUpperCase();
  }

  const addButton = $("#addButton");

  if (addButton) {
    addButton.style.display = "none";
  }

  bindEvents();
  renderAll();
}

init();