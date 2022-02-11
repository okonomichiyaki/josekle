def fetch_position(id)
  mode = 0
  uri = URI("https://online-go.com/oje/positions?id=#{id}&mode=#{mode}")
  req = Net::HTTP::Get.new(uri)
  req['Accept']='application/json'
  req['Content-Type']='application/json'
  req['User-Agent']='Mozilla/5.0 (X11; Linux x86_64; rv:96.0) Gecko/20100101 Firefox/96.0'
  req['Accept-Language']='en-US,en;q=0.5'
  req['Referer']='https://online-go.com/joseki'
  req['X-Godojo-Auth-Token']='foofer'
  req['X-User-Info']='eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhbm9ueW1vdXMiOnRydWUsImlkIjotNTE1MTksInVzZXJuYW1lIjoiZ3Vlc3Q1MTUxOSIsInJhbmtpbmciOi0xMDAsImNvdW50cnkiOiJ1biIsInBybyI6MH0.snSFeZqdRfKDHyioo7P-I2m7WbFXcgPTYCEh0eYAy7ovVynqq3UpeOxUdTMOWngJu168umD7fT8JZIp0UWFA7e_WSaRQp210wryzfSRKVueTp_2gdK7meSQRvRjUREFDyxrUisZDeYFU79k8Vh4INzlO-ZqVGn6paCVvd1BWgFKT3h7mRonTRyyT7oV_xoIEjUVyQuk895mnGHh1pcnxpJgzJ7O6eIoWJGwh5eFXYa5FL3LAW1ULw-T6mNVXMjmV5TfxWw_HMp11SPlEeI_tAxPEvRpNB09AAz6qDBPG1p1XF5qoIvFpCSYjhb3ZLykFQKkvOWMC-YtNQU7MpS3WTwOv1GuOdMMbHdgdiMbRCItVRo1Fv1UxME7M4zL-U9OSSO_JtwSqrTaukUjHiiUA5eT3WVyE7F91hMERsAl0Ld51a5apaZ4vwuclnwg-zzf7hA2d9jb5Yaz8AP1FRiGyzpn93HkEWVbBtNPsVQddrPEhv6edzugOv7uhxoeKu2RqMeBxFFt7jkeX2GdTVcp_DG0NmMLMRlzheTJdO_LlExXFJg9L7AnJZ_-YVD5uEl99-mLaomsIMjTA39k7d0KW0B0FTXzOKs0BaCDZB6n6LLloqdlx6pCyLsymWESDPaj8C7Eknyj6h2JAR1SF7-_kyYGugkbaEPpF4JsAuh4Ll6Q'
  req['X-CSRFToken']='LcEY2xWYxPx84ABNkGFrrKpqjWHO4i1qiIRlhDhMdRasbG1CkR8WseHOZn6OxrOB'
  req['DNT']='1'
  req['Connection']='keep-alive'
  req['Cookie']='csrftoken=LcEY2xWYxPx84ABNkGFrrKpqjWHO4i1qiIRlhDhMdRasbG1CkR8WseHOZn6OxrOB; sessionid=4iqrkmxnb5x9tcc6d50qgz235vlpsu14'
  req['Sec-Fetch-Dest']='empty'
  req['Sec-Fetch-Mode']='cors'
  req['Sec-Fetch-Site']='same-origin'
  req['TE']='trailers' 
  res = Net::HTTP.start(uri.hostname, uri.port, :use_ssl => true) {|http|
    http.request(req)
  }
  if (res.code == "200")
    return res.body
  else
    p res
    return nil
  end
end
