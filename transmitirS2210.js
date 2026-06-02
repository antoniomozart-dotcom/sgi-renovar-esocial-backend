export async function transmitirS2210(req, res){
  try{
    const { evento_id, cat_id } = req.body || {};

    if(!evento_id && !cat_id){
      return res.status(400).json({
        sucesso:false,
        erro:"Informe evento_id ou cat_id."
      });
    }

    return res.status(200).json({
      sucesso:true,
      mensagem:"Endpoint transmitir S-2210 ativo. Transmissão gov.br ainda em modo preparatório.",
      evento_id: evento_id || null,
      cat_id: cat_id || null,
      status:"preparacao"
    });

  }catch(error){
    return res.status(500).json({
      sucesso:false,
      erro:error.message
    });
  }
}