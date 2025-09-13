// helpers
function showMsg(el, txt, tm=3000){
  el.innerText = txt;
  if (tm>0) setTimeout(()=> el.innerText="", tm);
}
async function api(path, opts){
  opts = opts || {};
  opts.headers = opts.headers || {};
  if (!(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
  }
  const res = await fetch(path, opts);
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) throw data;
  return data;
}
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[m]); }

// elements
const authBlock = document.getElementById("auth");
const appBlock = document.getElementById("app");
const usernameEl = document.getElementById("username");
const passwordEl = document.getElementById("password");
const btnLogin = document.getElementById("btn-login");
const btnSignup = document.getElementById("btn-signup");
const authMsg = document.getElementById("auth-msg");
const welcomeEl = document.getElementById("welcome");
const btnLogout = document.getElementById("btn-logout");

const submitForm = document.getElementById("submitForm");
const inputTitle = document.getElementById("input-title");
const inputProblem = document.getElementById("input-problem");
const inputFile = document.getElementById("input-file");
const submitMsg = document.getElementById("submit-msg");

const ideasContainer = document.getElementById("ideasContainer");
const leaderboardContainer = document.getElementById("leaderboardContainer");

const compStatus = document.getElementById("comp-status");
const compCountdown = document.getElementById("comp-countdown");

// signup
btnSignup.onclick = async () => {
  try {
    const user = usernameEl.value.trim();
    const pass = passwordEl.value;
    if (!user || !pass) { showMsg(authMsg, "Enter username & password"); return; }
    await api("/api/signup", { method:"POST", body: JSON.stringify({username:user,password:pass}) });
    showMsg(authMsg, "Signup success! Please login.", 4000);
  } catch(err){
    showMsg(authMsg, err.error || "Signup failed", 4000);
  }
};

// login
btnLogin.onclick = async () => {
  try {
    const user = usernameEl.value.trim();
    const pass = passwordEl.value;
    if (!user || !pass) { showMsg(authMsg, "Enter username & password"); return; }
    const res = await api("/api/login", { method:"POST", body: JSON.stringify({username:user,password:pass}) });
    usernameEl.value = ""; passwordEl.value = "";
    authBlock.style.display = "none";
    appBlock.style.display = "block";
    welcomeEl.innerText = "Hello, " + res.username;
    await fetchAll();
  } catch(err){
    showMsg(authMsg, err.error || "Login failed", 4000);
  }
};

// logout
btnLogout.onclick = async () => {
  await api("/api/logout", { method:"POST" });
  appBlock.style.display = "none";
  authBlock.style.display = "block";
};

// submit idea
submitForm.onsubmit = async (e) => {
  e.preventDefault();
  try {
    const form = new FormData();
    form.append("title", inputTitle.value.trim());
    form.append("problem", inputProblem.value.trim());
    if (inputFile.files.length) form.append("file", inputFile.files[0]);
    await fetch("/api/submit", { method:"POST", body: form });
    showMsg(submitMsg, "Idea submitted!");
    inputTitle.value = ""; inputProblem.value = ""; inputFile.value = "";
    await fetchAll();
  } catch(err){
    showMsg(submitMsg, err.error || "Submit failed");
  }
};

// fetch all data
async function fetchAll(){
  try {
    const ideasRes = await api("/api/ideas");
    renderIdeas(ideasRes.ideas || []);
    const leader = await api("/api/leaderboard");
    renderLeaderboard(leader.top || []);
    const comp = await api("/api/competition");
    renderCompetition(comp);
  } catch(err){
    console.error("fetchAll err", err);
  }
}

function renderIdeas(list){
  ideasContainer.innerHTML = "";
  if (!list.length) { ideasContainer.innerHTML = "<p>No ideas yet.</p>"; return; }
  list.forEach(idea => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <h4>${escapeHtml(idea.title)}</h4>
      <p><strong>By:</strong> ${escapeHtml(idea.username || "Anon")}</p>
      <p>${escapeHtml(idea.problem)}</p>
      ${idea.filename ? `<p><a href="/uploads/${idea.filename}" target="_blank">Attachment</a></p>` : ""}
      <p>Votes: ${idea.votes}</p>
      <button class="vote-btn" data-id="${idea.id}">👍 Vote</button>
    `;
    ideasContainer.appendChild(el);
  });
  Array.from(document.querySelectorAll(".vote-btn")).forEach(b=>{
    b.onclick = async () => {
      const id = b.getAttribute("data-id");
      try {
        await api("/api/vote", { method: "POST", body: JSON.stringify({ idea_id: Number(id) }) });
        await fetchAll();
      } catch(err){
        alert(err.error || "Vote failed");
      }
    };
  });
}

function renderLeaderboard(list){
  leaderboardContainer.innerHTML = "";
  if (!list.length) { leaderboardContainer.innerHTML = "<p>No votes yet.</p>"; return; }
  const top3 = list.slice(0,3);
  top3.forEach((idea, idx)=>{
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<h4>#${idx+1} ${escapeHtml(idea.title)}</h4>
      <p><strong>By:</strong> ${escapeHtml(idea.username || "Anon")}</p>
      <p>Votes: ${idea.votes}</p>`;
    leaderboardContainer.appendChild(el);
  });
}

function renderCompetition(comp){
  if (!comp) return;
  compStatus.innerText = "Status: " + comp.status.toUpperCase();
  const end = new Date(comp.end);
  const now = new Date(comp.now);
  let diff = end - now;
  if (diff <= 0) {
    compCountdown.innerText = "Competition closed.";
    return;
  }
  const days = Math.floor(diff / (1000*60*60*24));
  const hours = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
  const minutes = Math.floor((diff % (1000*60*60)) / (1000*60));
  compCountdown.innerText = `Ends in ${days}d ${hours}h ${minutes}m`;
}

// on load: check session
(async ()=>{
  try {
    const me = await api("/api/me");
    if (me.logged_in) {
      authBlock.style.display = "none";
      appBlock.style.display = "block";
      welcomeEl.innerText = "Hello, " + (me.username || "User");
      await fetchAll();
    } else {
      authBlock.style.display = "block";
      appBlock.style.display = "none";
    }
  } catch(err){
    console.error(err);
    authBlock.style.display = "block";
    appBlock.style.display = "none";
  }
})();
