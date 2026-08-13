(() => {
  const STORAGE_KEY = "budget-app-data-v1";

  const DEFAULT_DATA = {
    overallBudget: 2360,
    categories: [
      { id: "gas", name: "Gas", limit: 120 },
      { id: "food", name: "Food", limit: 450 },
      { id: "hobby", name: "Hobby items", limit: 250 },
      { id: "misc", name: "Anything else", limit: 150 },
      { id: "savings", name: "Savings", limit: 1390 },
    ],
    transactions: [],
  };

  let data = loadData();

  // ---------- persistence ----------

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_DATA);
      const parsed = JSON.parse(raw);
      return {
        overallBudget: parsed.overallBudget ?? null,
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      };
    } catch {
      return structuredClone(DEFAULT_DATA);
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- month helpers ----------

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function currentMonthKey() {
    return monthKey(new Date());
  }

  function transactionsThisMonth() {
    const key = currentMonthKey();
    return data.transactions.filter((t) => monthKey(new Date(t.date)) === key);
  }

  function spentByCategory(categoryId) {
    return transactionsThisMonth()
      .filter((t) => t.categoryId === categoryId)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  function totalSpentThisMonth() {
    return transactionsThisMonth().reduce((sum, t) => sum + t.amount, 0);
  }

  function fmt(n) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function barClass(spent, limit) {
    if (!limit || limit <= 0) return "";
    const pct = spent / limit;
    if (pct > 1) return "over";
    if (pct >= 0.7) return "warn";
    return "";
  }

  // ---------- view switching ----------

  const views = ["dashboard", "add", "categories", "history"];

  function showView(name) {
    views.forEach((v) => {
      document.getElementById(`view-${v}`).classList.toggle("hidden", v !== name);
    });
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === name);
    });
    document.getElementById("topbar-title").textContent =
      { dashboard: "Budget", add: "Add expense", categories: "Categories", history: "History" }[name];

    if (name === "dashboard") renderDashboard();
    if (name === "categories") renderCategoriesEditor();
    if (name === "history") renderHistory();
    if (name === "add") resetAddForm();
  }

  // ---------- dashboard ----------

  function renderDashboard() {
    const spent = totalSpentThisMonth();
    const limit = data.overallBudget;

    document.getElementById("overall-spent").textContent = `$${fmt(spent)}`;
    document.getElementById("overall-limit").textContent = limit
      ? `of $${fmt(limit)}`
      : "no overall budget set";

    const bar = document.getElementById("overall-bar");
    bar.className = "bar-fill " + barClass(spent, limit);
    bar.style.transform = `scaleX(${limit ? Math.min(100, (spent / limit) * 100) / 100 : 0})`;

    const sub = document.getElementById("overall-sub");
    if (limit) {
      const remaining = limit - spent;
      sub.textContent = remaining >= 0
        ? `$${fmt(remaining)} left this month`
        : `$${fmt(Math.abs(remaining))} over this month`;
    } else {
      sub.textContent = "";
    }

    const list = document.getElementById("category-list");
    const empty = document.getElementById("empty-state");
    list.innerHTML = "";

    if (data.categories.length === 0) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    data.categories.forEach((cat) => {
      const spentCat = spentByCategory(cat.id);
      const card = document.createElement("div");
      card.className = "category-card";
      card.innerHTML = `
        <div class="category-card-top">
          <span>${escapeHtml(cat.name)}</span>
          <span class="amounts">$${fmt(spentCat)} / $${fmt(cat.limit)}</span>
        </div>
        <div class="bar"><div class="bar-fill ${barClass(spentCat, cat.limit)}"
             style="transform:scaleX(${cat.limit ? Math.min(100, (spentCat / cat.limit) * 100) / 100 : 0})"></div></div>
      `;
      list.appendChild(card);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- quick add ----------

  let addAmount = "0";
  let addCategoryId = null;

  function resetAddForm() {
    addAmount = "0";
    addCategoryId = data.categories[0]?.id ?? null;
    document.getElementById("note-input").value = "";
    document.getElementById("note-input").classList.add("hidden");
    document.getElementById("note-toggle").classList.remove("hidden");
    renderAddAmount();
    renderCategoryChips();
  }

  function renderAddAmount() {
    document.getElementById("amount-display").textContent = addAmount;
    const cat = data.categories.find((c) => c.id === addCategoryId);
    document.getElementById("add-category-name").textContent = cat
      ? cat.name
      : data.categories.length
        ? "choose a category below"
        : "add a category first (Categories tab)";
  }

  function renderCategoryChips() {
    const row = document.getElementById("category-chips");
    row.innerHTML = "";
    data.categories.forEach((cat) => {
      const chip = document.createElement("button");
      chip.className = "chip" + (cat.id === addCategoryId ? " selected" : "");
      chip.textContent = cat.name;
      chip.addEventListener("click", () => {
        addCategoryId = cat.id;
        renderAddAmount();
        renderCategoryChips();
      });
      row.appendChild(chip);
    });
  }

  function handleKeypad(key) {
    if (key === "back") {
      addAmount = addAmount.length > 1 ? addAmount.slice(0, -1) : "0";
    } else if (key === ".") {
      if (!addAmount.includes(".")) addAmount += ".";
    } else {
      if (addAmount === "0") addAmount = key;
      else if (addAmount.split(".")[1]?.length >= 2) return;
      else addAmount += key;
    }
    renderAddAmount();
  }

  function saveTransaction() {
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) return;
    if (!addCategoryId) return;

    data.transactions.push({
      id: uid(),
      amount,
      categoryId: addCategoryId,
      note: document.getElementById("note-input").value.trim(),
      date: new Date().toISOString(),
    });
    saveData();
    showView("dashboard");
  }

  // ---------- categories setup ----------

  function renderCategoriesEditor() {
    document.getElementById("overall-budget-input").value = data.overallBudget ?? "";

    const editor = document.getElementById("categories-editor");
    editor.innerHTML = "";
    data.categories.forEach((cat) => {
      const row = document.createElement("div");
      row.className = "category-edit-row";
      row.innerHTML = `
        <span class="cat-name">${escapeHtml(cat.name)}</span>
        <input type="number" inputmode="decimal" min="0" value="${cat.limit}">
        <button class="delete-btn" aria-label="Delete category">✕</button>
      `;
      row.querySelector("input").addEventListener("change", (e) => {
        cat.limit = parseFloat(e.target.value) || 0;
        saveData();
      });
      row.querySelector(".delete-btn").addEventListener("click", () => {
        data.categories = data.categories.filter((c) => c.id !== cat.id);
        saveData();
        renderCategoriesEditor();
      });
      editor.appendChild(row);
    });
  }

  // ---------- history ----------

  function renderHistoryFilterOptions() {
    const select = document.getElementById("history-filter-category");
    const current = select.value;
    select.innerHTML = `<option value="all">All categories</option>` +
      data.categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    if ([...select.options].some((o) => o.value === current)) select.value = current;
  }

  function renderHistory() {
    renderHistoryFilterOptions();
    const filter = document.getElementById("history-filter-category").value || "all";
    const list = document.getElementById("history-list");
    const empty = document.getElementById("history-empty");
    list.innerHTML = "";

    const catName = (id) => data.categories.find((c) => c.id === id)?.name ?? "(deleted)";

    const items = [...data.transactions]
      .filter((t) => filter === "all" || t.categoryId === filter)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (items.length === 0) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    items.forEach((t) => {
      const row = document.createElement("div");
      row.className = "history-row";
      const d = new Date(t.date);
      row.innerHTML = `
        <div class="hr-main">
          <span class="hr-cat">${escapeHtml(catName(t.categoryId))}</span>
          <span class="hr-date">${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}${t.note ? " · " + escapeHtml(t.note) : ""}</span>
        </div>
        <span class="hr-amount">$${fmt(t.amount)}</span>
        <button class="delete-btn" aria-label="Delete transaction">✕</button>
      `;
      row.querySelector(".delete-btn").addEventListener("click", () => {
        data.transactions = data.transactions.filter((x) => x.id !== t.id);
        saveData();
        renderHistory();
      });
      list.appendChild(row);
    });
  }

  // ---------- wiring ----------

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  document.getElementById("btn-fab").addEventListener("click", () => showView("add"));
  document.getElementById("btn-history").addEventListener("click", () => showView("history"));
  document.getElementById("btn-empty-setup")?.addEventListener("click", () => showView("categories"));

  document.getElementById("keypad").addEventListener("click", (e) => {
    const key = e.target.closest("button")?.dataset.key;
    if (key) handleKeypad(key);
  });

  document.getElementById("note-toggle").addEventListener("click", () => {
    document.getElementById("note-input").classList.remove("hidden");
    document.getElementById("note-toggle").classList.add("hidden");
    document.getElementById("note-input").focus();
  });

  document.getElementById("btn-cancel-add").addEventListener("click", () => showView("dashboard"));
  document.getElementById("btn-save-add").addEventListener("click", saveTransaction);

  document.getElementById("overall-budget-input").addEventListener("change", (e) => {
    const v = parseFloat(e.target.value);
    data.overallBudget = v > 0 ? v : null;
    saveData();
  });

  document.getElementById("form-new-category").addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("new-category-name");
    const limitInput = document.getElementById("new-category-limit");
    const name = nameInput.value.trim();
    const limit = parseFloat(limitInput.value);
    if (!name || !(limit >= 0)) return;
    data.categories.push({ id: uid(), name, limit });
    saveData();
    nameInput.value = "";
    limitInput.value = "";
    renderCategoriesEditor();
    nameInput.focus();
  });

  document.getElementById("btn-done-categories").addEventListener("click", () => showView("dashboard"));
  document.getElementById("history-filter-category").addEventListener("change", renderHistory);

  // ---------- PWA ----------

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }

  // ---------- init ----------

  showView("dashboard");
})();
