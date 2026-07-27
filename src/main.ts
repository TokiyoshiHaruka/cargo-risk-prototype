import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("app root missing");

app.innerHTML = `
  <main class="boot-shell">
    <section class="boot-copy">
      <p class="kicker">CARGO RISK / ROUTE TRIAL</p>
      <h1>Simulation loading</h1>
      <p class="muted">The playable route scene will appear in the next implementation step.</p>
    </section>
  </main>
`;
