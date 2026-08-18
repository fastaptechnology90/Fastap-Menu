const base = process.argv[2] || "https://digitalrestuarants.thefingo.com";
const html = await (await fetch(base + "/")).text();
const m = html.match(/index-[^"']+\.js/);
console.log("site:", base);
console.log("bundle:", m?.[0] ?? "not found");
if (m) {
  const js = await (await fetch(`${base}/${m[0]}`)).text();
  console.log("Select your role:", js.includes("Select your role"));
  console.log("Register with KYC:", js.includes("Register with KYC"));
  console.log("spicegarden.com:", js.includes("spicegarden.com"));
  console.log("Sign in as:", js.includes("Sign in as"));
}
