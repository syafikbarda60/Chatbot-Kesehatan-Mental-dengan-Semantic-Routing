import { CounselorDirectoryPage } from '@/features/counselors/CounselorDirectoryPage';

export default async function Page({ params }: { params: Promise<{ counselorId: string }> }) {
  const { counselorId } = await params;
  return <CounselorDirectoryPage initialCounselorId={counselorId} />;
}
