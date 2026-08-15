import { ToastProvider } from "@/components/ui/Toast";
import { VaultProvider, useVault } from "@/store";
import { LockScreen } from "@/screens/LockScreen";
import { Vault } from "@/screens/Vault";

function Router() {
  const { status } = useVault();

  if (status === "loading") {
    return (
      <div className="grid h-full place-items-center bg-ink-900">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-600 border-t-brass-500" />
      </div>
    );
  }
  if (status === "onboarding") return <LockScreen mode="onboarding" />;
  if (status === "locked") return <LockScreen mode="locked" />;
  return <Vault />;
}

export default function App() {
  return (
    <ToastProvider>
      <VaultProvider>
        <Router />
      </VaultProvider>
    </ToastProvider>
  );
}
