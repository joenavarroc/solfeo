const buttons = document.querySelectorAll(".menu-btn");

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;

    if(mode === "scales"){
      window.location.href = "scales.html";
    }

    if(mode === "intervals"){
      window.location.href = "intervals.html";
    }

    if(mode === "reading"){
      window.location.href = "reading.html";
    }

    if(mode === "rhythm"){
      window.location.href = "rhythm.html";
    }
  });
});
