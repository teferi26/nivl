import { sealLetter } from '../contract';
import { supabase } from '../supabase';
import { LIMITE_RED_MS } from '../limiteRed';
jest.mock('../data',()=>({awardXpRpc:jest.fn()}));
jest.mock('../supabase',()=>({supabase:{auth:{getSession:jest.fn()},rpc:jest.fn(),from:jest.fn()}}));
const session=jest.mocked(supabase.auth.getSession);
const rpc=jest.mocked(supabase.rpc);
const frozen={id:'same-letter',user_id:'account-a',body:'Frozen signed body',open_at:'2030-01-01',sealed_at:'2026-10-07T10:00:00Z',opened_at:null};
beforeEach(()=>{
  jest.clearAllMocks();
  session.mockReset().mockResolvedValue({data:{session:{user:{id:'account-a'}}},error:null} as never);
  rpc.mockReset().mockResolvedValue({data:frozen,error:null} as never);
});
test('seal uses authenticated idempotent RPC and never a direct INSERT',async()=>{
  await expect(sealLetter('account-a',frozen.body,frozen.open_at)).resolves.toEqual(frozen);
  expect(rpc).toHaveBeenCalledWith('seal_letter',{p_user:'account-a',p_body:frozen.body,p_open_at:frozen.open_at,p_health_data:false});
  expect(supabase.from).not.toHaveBeenCalled();
});
test('lost response retry carries exactly the same frozen signature and gets same sealed row',async()=>{
  const network=new Error('network response lost');
  rpc.mockResolvedValueOnce({data:null,error:network} as never);
  await expect(sealLetter('account-a',frozen.body,frozen.open_at,true)).rejects.toBe(network);
  await expect(sealLetter('account-a',frozen.body,frozen.open_at,true)).resolves.toEqual(frozen);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
});
test('session changed or failed prevents any request for the wrong account',async()=>{
  session.mockResolvedValueOnce({data:{session:{user:{id:'account-b'}}},error:null} as never);
  await expect(sealLetter('account-a',frozen.body,frozen.open_at)).rejects.toThrow(/cuenta ha cambiado/);
  expect(rpc).not.toHaveBeenCalled();
  const network=new Error('network');
  session.mockResolvedValueOnce({data:{session:null},error:network} as never);
  await expect(sealLetter('account-a',frozen.body,frozen.open_at)).rejects.toBe(network);
  expect(rpc).not.toHaveBeenCalled();
});
test('ambiguous response never claims that a different letter was signed',async()=>{
  rpc.mockResolvedValueOnce({data:{...frozen,user_id:'account-b'},error:null} as never);
  await expect(sealLetter('account-a',frozen.body,frozen.open_at)).rejects.toThrow(/confirmar la carta/);
});
test('hanging RPC has a bounded wait while its server operation can safely be retried',async()=>{
  jest.useFakeTimers();
  try {
    rpc.mockImplementationOnce(()=>new Promise(()=>{}) as never);
    const pending=sealLetter('account-a',frozen.body,frozen.open_at);
    const rejected=expect(pending).rejects.toThrow('timeout');
    await jest.advanceTimersByTimeAsync(LIMITE_RED_MS+1);
    await rejected;
    await expect(sealLetter('account-a',frozen.body,frozen.open_at)).resolves.toEqual(frozen);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  } finally {jest.useRealTimers();}
});
