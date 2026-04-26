(function () {
  var s = document.currentScript;
  if (!s) return;
  var slug = s.getAttribute("data-venue");
  var origin = s.getAttribute("data-origin") || (function () {
    try {
      return new URL(s.src).origin;
    } catch (e) {
      return "";
    }
  })();
  if (!slug || !origin) return;

  var btn = document.createElement("button");
  btn.setAttribute("aria-label", "Apri chat prenotazioni");
  btn.style.cssText =
    "position:fixed;right:20px;bottom:20px;z-index:2147483646;width:56px;height:56px;border-radius:9999px;border:none;background:#15161a;color:#f7f4ec;font-size:22px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18);";
  btn.innerHTML = "✨";

  var box = document.createElement("div");
  box.style.cssText =
    "position:fixed;right:20px;bottom:88px;z-index:2147483646;width:360px;max-width:calc(100vw - 28px);height:560px;max-height:calc(100vh - 120px);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 14px 38px rgba(0,0,0,.18);display:none;";
  var iframe = document.createElement("iframe");
  iframe.title = "Chat";
  iframe.style.cssText = "width:100%;height:100%;border:0;display:block;";
  iframe.src = origin + "/chat/" + encodeURIComponent(slug);
  box.appendChild(iframe);

  function toggle() {
    var open = box.style.display === "block";
    box.style.display = open ? "none" : "block";
    btn.innerHTML = open ? "✨" : "×";
  }
  btn.addEventListener("click", toggle);

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(box);
    document.body.appendChild(btn);
  });
  if (document.readyState !== "loading") {
    document.body.appendChild(box);
    document.body.appendChild(btn);
  }
})();
