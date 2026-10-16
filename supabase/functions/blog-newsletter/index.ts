import { createRemoteJWKSet, jwtVerify } from "jose";
import { createHandler } from "./handler.js";

const jwks = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
Deno.serve(createHandler({
  env: (name: string) => Deno.env.get(name),
  verifyToken: async (token: string, audience: string) => {
    const result = await jwtVerify(token, jwks, {
      issuer: "https://token.actions.githubusercontent.com",
      audience,
      algorithms: ["RS256"],
      maxTokenAge: "10m",
    });
    return result.payload;
  },
}));
