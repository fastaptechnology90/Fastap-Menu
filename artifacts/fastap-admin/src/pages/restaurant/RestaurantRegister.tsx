import { useState } from "react";
import { Link } from "wouter";
import { restaurantAuth } from "@/lib/api";
import { Icon } from "@/components/shared/Icon";
import { PanelLogo } from "@/components/shared/PanelLogo";
import { IMAGES } from "@/lib/media";

type Step = 1 | 2 | 3 | 4;

const REQUIRED_BUSINESS_DOCS = [
  { id: "gst_certificate", label: "GST registration certificate", required: true },
  { id: "fssai_license", label: "FSSAI license copy", required: true },
  { id: "business_registration", label: "Business registration / Shop Act license", required: true },
  { id: "bank_proof", label: "Bank proof (cancelled cheque or statement)", required: true },
] as const;

type RegDocument = {
  type: string;
  name: string;
  fileUrl: string;
  fileName?: string;
  fileType?: string;
};

const BUSINESS_TYPES = [
  { id: "restaurant", label: "Restaurant" },
  { id: "cafe", label: "Café" },
  { id: "hotel", label: "Hotel" },
  { id: "bar", label: "Bar / Lounge" },
  { id: "cloud_kitchen", label: "Cloud Kitchen" },
  { id: "franchise", label: "Franchise" },
];

const STEPS = ["Account", "Business", "KYC", "Review"];

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;

async function fileToUploadData(file: File): Promise<{ fileUrl: string; fileName: string; fileType: string }> {
  if (file.size > MAX_FILE_BYTES && !file.type.startsWith("image/")) {
    throw new Error(`${file.name} exceeds 5 MB. Use a smaller PDF.`);
  }
  if (file.type.startsWith("image/")) {
    const compressed = await compressImage(file);
    if (compressed.blob.size > MAX_FILE_BYTES) {
      throw new Error(`${file.name} is still too large after compression. Try a smaller image.`);
    }
    const fileUrl = await blobToDataUrl(compressed.blob);
    return { fileUrl, fileName: file.name, fileType: compressed.mime };
  }
  const fileUrl = await readFileAsDataUrl(file);
  if (fileUrl.length > MAX_FILE_BYTES * 1.4) {
    throw new Error(`${file.name} exceeds 5 MB.`);
  }
  return { fileUrl, fileName: file.name, fileType: file.type || "application/octet-stream" };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read compressed image"));
    reader.readAsDataURL(blob);
  });
}

function compressImage(file: File): Promise<{ blob: Blob; mime: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process image"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => {
          if (!blob) {
            reject(new Error("Could not compress image"));
            return;
          }
          resolve({ blob, mime: "image/jpeg" });
        },
        "image/jpeg",
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid image file"));
    };
    img.src = url;
  });
}

function hasDoc(docs: RegDocument[], type: string) {
  return docs.some(d => d.type === type && d.fileUrl?.trim());
}

function validateOwnerDocuments(docs: RegDocument[]): string | null {
  for (const req of REQUIRED_BUSINESS_DOCS) {
    if (req.required && !hasDoc(docs, req.id)) {
      return `Upload required document: ${req.label}`;
    }
  }
  return null;
}

function DocUploadField({
  docDef,
  doc,
  onUpload,
  onClear,
}: {
  docDef: { id: string; label: string; required: boolean };
  doc?: RegDocument;
  onUpload: (d: RegDocument) => void;
  onClear: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-white/80 leading-snug">
          {docDef.label}
          {docDef.required && <span className="text-red-400 ml-1">*</span>}
        </p>
        {doc?.fileName && (
          <button type="button" onClick={onClear} className="text-[10px] text-red-400 shrink-0">Remove</button>
        )}
      </div>
      <label className={`flex items-center gap-2 ${uploading ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}>
        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/25">
          <Icon name="upload_file" size={16} />
          {uploading ? "Processing…" : doc?.fileName ? "Replace file" : "Choose file"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          disabled={uploading}
          onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            void fileToUploadData(file)
              .then(data => {
                onUpload({
                  type: docDef.id,
                  name: docDef.label,
                  fileUrl: data.fileUrl,
                  fileName: data.fileName,
                  fileType: data.fileType,
                });
              })
              .catch(err => {
                alert(err instanceof Error ? err.message : "Upload failed");
              })
              .finally(() => {
                setUploading(false);
                e.target.value = "";
              });
          }}
        />
      </label>
      {doc?.fileName && (
        <p className="text-[11px] text-emerald-400 flex items-center gap-1">
          <Icon name="check_circle" size={14} /> {doc.fileName}
        </p>
      )}
    </div>
  );
}

export default function RestaurantRegister() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedVenue, setSubmittedVenue] = useState("");

  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  const [restaurantName, setRestaurantName] = useState("");
  const [businessType, setBusinessType] = useState("restaurant");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [restaurantPhone, setRestaurantPhone] = useState("");
  const [restaurantEmail, setRestaurantEmail] = useState("");
  const [website, setWebsite] = useState("");

  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [fssaiNumber, setFssaiNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [documents, setDocuments] = useState<RegDocument[]>([]);

  function upsertDocument(doc: RegDocument) {
    setDocuments(prev => {
      const rest = prev.filter(d => d.type !== doc.type);
      return [...rest, doc];
    });
  }

  function removeDocument(type: string) {
    setDocuments(prev => prev.filter(d => d.type !== type));
  }

  function getDoc(type: string) {
    return documents.find(d => d.type === type);
  }

  async function submitRegistration() {
    setLoading(true);
    setError("");
    try {
      const result = await restaurantAuth.register({
        staffRole: "owner",
        ownerName,
        ownerEmail,
        ownerPassword,
        ownerPhone: ownerPhone.replace(/\D/g, ""),
        restaurantName,
        businessType,
        address,
        city,
        state,
        pincode,
        restaurantPhone,
        restaurantEmail,
        website,
        legalBusinessName: legalBusinessName || restaurantName,
        gstNumber,
        fssaiNumber,
        panNumber,
        bankAccount,
        ifsc,
        documents,
      });
      if (result.pendingApproval) {
        setSubmittedVenue(result.restaurant?.name || restaurantName);
        setSubmitted(true);
        return;
      }
      setError("Registration completed but requires admin approval before sign-in.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  function validateStep(): boolean {
    setError("");

    if (step === 1) {
      if (!ownerName || !ownerEmail || ownerPassword.length < 6 || ownerPhone.replace(/\D/g, "").length < 10) {
        setError("Complete name, email, mobile, and password (6+ chars)");
        return false;
      }
    }
    if (step === 2 && (!restaurantName || !address)) {
      setError("Restaurant name and address are required");
      return false;
    }
    if (step === 3) {
      if (!gstNumber.trim() || !fssaiNumber.trim()) {
        setError("GST and FSSAI numbers are both required");
        return false;
      }
      if (!panNumber.trim()) {
        setError("Business PAN number is required");
        return false;
      }
      if (!bankAccount.trim() || !ifsc.trim()) {
        setError("Bank account and IFSC are required");
        return false;
      }
      const docErr = validateOwnerDocuments(documents);
      if (docErr) {
        setError(docErr);
        return false;
      }
    }
    return true;
  }

  function handleContinue() {
    if (!validateStep()) return;
    if (step < STEPS.length) setStep((step + 1) as Step);
  }

  function handleSubmit() {
    const docErr = validateOwnerDocuments(documents);
    if (docErr) {
      setError(docErr);
      return;
    }
    void submitRegistration();
  }

  return (
    <div className="restaurant-panel min-h-screen flex flex-col lg:flex-row">
      {submitted ? (
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center space-y-5">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Icon name="check_circle" size={36} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold">Registration submitted</h1>
            <p className="text-white/60 text-sm leading-relaxed">
              <span className="text-amber-400 font-semibold">{submittedVenue}</span> has been sent to the super admin panel for KYC review.
              You will be able to sign in to the restaurant dashboard only after your documents are approved.
            </p>
            <p className="text-xs text-white/40">
              Check your email ({ownerEmail}) for updates. Approval usually takes 1–2 business days.
            </p>
            <Link
              href="/restaurant/login"
              className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-sm"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      ) : (
      <>
      <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden">
        <img src={IMAGES.heroKitchen} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222,47%,5%)] via-[hsl(222,47%,5%)]/85 to-transparent" />
        <div className="relative p-10 flex flex-col justify-between min-h-full">
          <PanelLogo panel="restaurant" size="lg" showLabel label="FastMenu" />
          <div>
            <h2 className="font-display text-2xl font-bold mb-2">Register as restaurant owner</h2>
            <p className="text-white/55 text-sm">
              Create your venue account with full KYC verification. Your application is reviewed by our team before dashboard access is granted.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">👑 Owner registration</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10">KYC required</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10">Admin approval</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-10">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6 lg:hidden">
            <div className="flex justify-center mb-3"><PanelLogo panel="restaurant" size="lg" /></div>
            <h1 className="font-display text-xl font-extrabold">Restaurant Owner Registration</h1>
            <p className="text-sm text-white/40 mt-1">Register your restaurant on FastMenu</p>
          </div>

          <div className="hidden lg:block mb-6">
            <h1 className="text-2xl font-bold">Restaurant Owner Registration</h1>
            <p className="text-sm text-white/45 mt-1">Complete all steps to submit your venue for approval</p>
          </div>

          <div className="flex gap-1 mb-6 overflow-x-auto">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={`flex-shrink-0 flex-1 min-w-[4rem] text-center text-[10px] sm:text-xs py-2 px-1 rounded-lg border ${
                  step === i + 1 ? "border-amber-500/50 bg-amber-500/15 text-amber-300" : step > i + 1 ? "border-emerald-500/30 text-emerald-400" : "border-white/10 text-white/30"
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold mb-4">Owner account</h2>
              <input className="field" placeholder="Full name" value={ownerName} onChange={e => setOwnerName(e.target.value)} />
              <input className="field" placeholder="Email" type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} />
              <input className="field" placeholder="Mobile (+91)" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
              <input className="field" placeholder="Password (min 6 characters)" type="password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold mb-4">Business details</h2>
              <input className="field" placeholder="Restaurant / brand name" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} />
              <select className="field" value={businessType} onChange={e => setBusinessType(e.target.value)}>
                {BUSINESS_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <input className="field" placeholder="Street address" value={address} onChange={e => setAddress(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className="field" placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
                <input className="field" placeholder="State" value={state} onChange={e => setState(e.target.value)} />
              </div>
              <input className="field" placeholder="PIN code" value={pincode} onChange={e => setPincode(e.target.value)} />
              <input className="field" placeholder="Business phone" value={restaurantPhone} onChange={e => setRestaurantPhone(e.target.value)} />
              <input className="field" placeholder="Business email (optional)" type="email" value={restaurantEmail} onChange={e => setRestaurantEmail(e.target.value)} />
              <input className="field" placeholder="Website (optional)" value={website} onChange={e => setWebsite(e.target.value)} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold mb-4">KYC & compliance</h2>
              <input className="field" placeholder="Legal business name" value={legalBusinessName} onChange={e => setLegalBusinessName(e.target.value)} />
              <input className="field" placeholder="GST number" value={gstNumber} onChange={e => setGstNumber(e.target.value)} />
              <input className="field" placeholder="FSSAI license number" value={fssaiNumber} onChange={e => setFssaiNumber(e.target.value)} />
              <input className="field" placeholder="PAN number" value={panNumber} onChange={e => setPanNumber(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className="field" placeholder="Bank account" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
                <input className="field" placeholder="IFSC code" value={ifsc} onChange={e => setIfsc(e.target.value)} />
              </div>
              <div className="border border-white/10 rounded-xl p-4 space-y-3 mt-2">
                <p className="text-xs text-white/50 font-semibold uppercase">Business & compliance documents</p>
                <p className="text-[11px] text-white/40">GST certificate, FSSAI license, business registration, and bank proof are mandatory.</p>
                {REQUIRED_BUSINESS_DOCS.map(def => (
                  <DocUploadField
                    key={def.id}
                    docDef={def}
                    doc={getDoc(def.id)}
                    onUpload={upsertDocument}
                    onClear={() => removeDocument(def.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-sm text-white/70">
              <h2 className="text-xl font-bold mb-4 text-white">Review & submit</h2>
              <p><span className="text-white/40">Role:</span> Restaurant Owner</p>
              <p><span className="text-white/40">Name:</span> {ownerName} · {ownerEmail}</p>
              <p><span className="text-white/40">Venue:</span> {restaurantName} ({businessType})</p>
              <p><span className="text-white/40">Address:</span> {[address, city, state, pincode].filter(Boolean).join(", ")}</p>
              <p><span className="text-white/40">GST:</span> {gstNumber || "—"} · <span className="text-white/40">FSSAI:</span> {fssaiNumber || "—"}</p>
              <p><span className="text-white/40">Documents:</span> {documents.length} attached ({REQUIRED_BUSINESS_DOCS.filter(d => d.required && hasDoc(documents, d.id)).length}/{REQUIRED_BUSINESS_DOCS.filter(d => d.required).length} business)</p>
              <p className="text-xs text-white/40 pt-2">
                By submitting you confirm the business information is accurate. Your venue will be activated after super admin verification.
              </p>
            </div>
          )}

          {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button type="button" onClick={() => setStep((step - 1) as Step)} className="flex-1 py-3 rounded-xl border border-white/15 text-sm font-semibold text-white/70">
                Back
              </button>
            )}
            {step < STEPS.length ? (
              <button type="button" onClick={handleContinue} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-sm">
                Continue
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={loading} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 font-bold text-sm">
                {loading ? "Submitting…" : "Submit for approval"}
              </button>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-white/40">
            Already registered?{" "}
            <Link href="/restaurant/login" className="text-amber-400 hover:text-amber-300 font-semibold">Sign in</Link>
          </p>
          <p className="mt-2 text-center text-xs text-white/30">
            Staff members should ask their manager for access — this page is for restaurant owners only.
          </p>
        </div>
      </div>

      <style>{`.field{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:.75rem;padding:.875rem 1rem;font-size:.875rem;color:#fff}.field:focus{outline:none;border-color:rgba(245,158,11,.5)}select.field{padding-right:2.5rem;min-height:2.75rem;cursor:pointer}`}</style>
      </>
      )}
    </div>
  );
}
