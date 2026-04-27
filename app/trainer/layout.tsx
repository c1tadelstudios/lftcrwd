import TrainerSidebar from '@/components/TrainerSidebar';

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:flex md:h-screen md:overflow-hidden">
      <TrainerSidebar />
      <div className="flex-1 md:overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
