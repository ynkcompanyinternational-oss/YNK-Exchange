document.getElementById("year").textContent = new Date().getFullYear();

const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
toggle?.addEventListener("click", () => {
  const open = nav.style.display === "flex";
  nav.style.display = open ? "" : "flex";
  nav.style.flexDirection = "column";
  nav.style.position = "absolute";
  nav.style.top = "70px";
  nav.style.left = "20px";
  nav.style.right = "20px";
  nav.style.padding = "18px";
  nav.style.background = "rgba(4,8,13,.98)";
  nav.style.border = "1px solid rgba(183,154,89,.25)";
});

document.getElementById("asset-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const asset = document.getElementById("asset").value;
  const amount = document.getElementById("amount").value;
  const status = document.getElementById("form-status");
  status.hidden = false;
  status.textContent =
    `Request received for ${amount} ${asset}. This demo does not process payments or transfer assets. ` +
    `In production, the request will be routed to the responsible operations workflow after the required checks.`;
});
