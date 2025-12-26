import { z } from "zod";

export const postSchema = z.object({
    topicType: z.enum(["STANDARD", "EVENT", "OFFER", "ALERT"]),
    summary: z.string().min(10, "A postagem deve ter pelo menos 10 caracteres").max(1500, "A postagem não pode exceder 1500 caracteres"),
    callToAction: z.object({
        actionType: z.enum(["BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL"]),
        url: z.string().url("URL inválida").optional().or(z.literal("")),
    }).optional(),
});

export const locationSchema = z.object({
    title: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
    phone: z.string().min(10, "Telefone inválido").optional().or(z.literal("")),
    website: z.string().url("URL inválida").optional().or(z.literal("")),
});

export type PostFormValues = z.infer<typeof postSchema>;
export type LocationFormValues = z.infer<typeof locationSchema>;
