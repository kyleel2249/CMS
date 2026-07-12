export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-mono text-primary font-bold shadow-primary/20 drop-shadow-lg">404</h1>
        <p className="text-xl text-muted-foreground uppercase tracking-widest font-mono">Module Not Found</p>
      </div>
    </div>
  );
}
