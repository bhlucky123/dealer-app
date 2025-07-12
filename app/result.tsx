import DrawResultForm from "@/components/draw-result-form";
import useDraw from "@/hooks/use-draw";
import useDrawStore from "@/store/draw";

const ResultPage = () => {
    const { createDrawResult } = useDraw();
    const { selectedDraw } = useDrawStore();


    return (
        <DrawResultForm
            onSubmit={async (resultData) => {
                console.log("on submit", resultData);
                
                await createDrawResult.mutateAsync({
                    ...resultData,
                    draw_id: selectedDraw?.id,
                });
            }}
        />
    )
}
export default ResultPage