import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Globe, Palette, CheckCircle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";

export default function WhiteLabel() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({ queryKey: ["platform-settings"], queryFn: api.settings.get });
  const [domain, setDomain] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [appName, setAppName] = useState("");
  const [domainVerified, setDomainVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const wl = (settings as any).whiteLabel ?? {};
    setDomain(wl.domain ?? settings.platformUrl ?? "");
    setPrimaryColor(wl.primaryColor ?? "#6366f1");
    setAppName(wl.appName ?? settings.platformName ?? "Fastap OS");
    setDomainVerified(!!wl.domainVerified);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.settings.update({
      platformName: data.appName,
      whiteLabel: { domain: data.domain, primaryColor: data.primaryColor, appName: data.appName, domainVerified },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
      toast.success("White label configuration saved");
    },
    onError: () => toast.error("Failed to save configuration"),
  });

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight">White Label Management</h2><p className="text-muted-foreground">Platform branding stored in system settings.</p></div>
        <Button onClick={() => saveMutation.mutate({ domain, primaryColor, appName })} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Domain Mapping</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Custom Domain URL</Label>
              <Input placeholder="admin.vendorbrand.com" value={domain} onChange={e => { setDomain(e.target.value); setDomainVerified(false); }} />
            </div>
            <Button
              variant="secondary"
              disabled={!domain || verifying}
              onClick={async () => {
                setVerifying(true);
                try {
                  const result = await api.settings.verifyWhiteLabelDns(domain);
                  if (result.verified) {
                    setDomainVerified(true);
                    qc.invalidateQueries({ queryKey: ["platform-settings"] });
                    toast.success(`Domain verified via ${result.method?.toUpperCase() ?? "DNS"}`);
                  } else {
                    setDomainVerified(false);
                    toast.error(result.error ?? "DNS verification failed");
                  }
                } catch {
                  toast.error("DNS verification request failed");
                } finally {
                  setVerifying(false);
                }
              }}
            >
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify DNS
            </Button>
            <p className="text-xs text-muted-foreground">
              Add TXT <code className="text-[11px]">_fastap.{domain || "yourdomain.com"}</code> → <code className="text-[11px]">fastap-verify</code>
            </p>
            {domainVerified && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md text-sm text-green-500 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Domain verified in platform settings
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Branding</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Platform Name</Label><Input value={appName} onChange={e => setAppName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Primary Color</Label><Input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-20" /></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
