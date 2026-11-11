'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Topic} from '@/lib/realtime/notice';
import {useLiveRefresh} from '@/lib/realtime/useLiveRefresh';
// `live` opts a page into background refresh (see useLiveRefresh). Pages with forms leave it out.
export function useCounselorData<T>(loader:(signal:AbortSignal)=>Promise<T>,live?:{topics?:readonly Topic[];pollMs?:number}){const[data,setData]=useState<T|null>(null);const[error,setError]=useState('');const[revision,setRevision]=useState(0);const loaded=useRef(false);useEffect(()=>{const controller=new AbortController();loader(controller.signal).then((value)=>{loaded.current=true;setData(value)}).catch((reason:unknown)=>{
// a failed background refresh keeps what is on screen; only a first load reports the error
if(!controller.signal.aborted&&!loaded.current)setError(reason instanceof Error?reason.message:String(reason))});return()=>controller.abort()},[loader,revision]);useLiveRefresh(useCallback(()=>setRevision((value)=>value+1),[]),live??null);return{data,error,retry:useCallback(()=>{loaded.current=false;setError('');setData(null);setRevision((value)=>value+1)},[])}}
