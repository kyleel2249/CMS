import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ThemeProvider } from './components/theme-provider';
import { AppShell } from './components/layout/AppShell';
import { Toaster } from 'sonner';

// Pages
import Dashboard from './pages/Dashboard';
import CrmHub from './pages/CrmHub';
import SalesPipeline from './pages/SalesPipeline';
import SupportTickets from './pages/SupportTickets';
import MarketingCampaigns from './pages/MarketingCampaigns';
import FinanceInvoices from './pages/FinanceInvoices';
import Projects from './pages/Projects';
import AiCommandCenter from './pages/AiCommandCenter';
import Analytics from './pages/Analytics';
import Knowledge from './pages/Knowledge';
import Automations from './pages/Automations';
import Collaboration from './pages/Collaboration';
import Extensions from './pages/Extensions';
import ActivityStream from './pages/ActivityStream';
import Anomalies from './pages/Anomalies';
import Goals from './pages/Goals';
import NotFound from './pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/crm" component={CrmHub} />
        <Route path="/sales" component={SalesPipeline} />
        <Route path="/support" component={SupportTickets} />
        <Route path="/marketing" component={MarketingCampaigns} />
        <Route path="/finance" component={FinanceInvoices} />
        <Route path="/projects" component={Projects} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/knowledge" component={Knowledge} />
        <Route path="/automations" component={Automations} />
        <Route path="/collaboration" component={Collaboration} />
        <Route path="/extensions" component={Extensions} />
        <Route path="/activity" component={ActivityStream} />
        <Route path="/anomalies" component={Anomalies} />
        <Route path="/goals" component={Goals} />
        <Route path="/ai" component={AiCommandCenter} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="nexus-theme">
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: 'bg-card border border-border text-foreground font-mono text-sm',
                success: 'border-primary/50',
                error: 'border-destructive/50',
              },
            }}
          />
        </WouterRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
