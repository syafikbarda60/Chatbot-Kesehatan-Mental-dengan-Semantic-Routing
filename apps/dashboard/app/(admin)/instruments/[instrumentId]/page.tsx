import { InstrumentDetailPage } from '@/features/instruments/InstrumentDetailPage';
export default function Page({params}:{params:Promise<{instrumentId:string}>}) { return <InstrumentDetailPage params={params}/>; }
