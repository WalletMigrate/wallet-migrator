import { http } from 'viem'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { entryPoint07Address } from "viem/account-abstraction"

const URL_BASE = "https://api.pimlico.io/v2/1/rpc?apikey=pim_T7hZTmEY2sbZr8AgsACNey";

const pimlicoClient = createPimlicoClient({ 
  transport: http(URL_BASE),
  entryPoint: {
    address: entryPoint07Address,
    version: "0.7",
  }
})

export { pimlicoClient }
