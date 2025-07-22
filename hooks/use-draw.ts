import api from "@/utils/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type Draw = {
  id?: number;
  name: string;
  valid_from: string;
  valid_till: string;
  cut_off_time: string;
  draw_time: string;
  color_theme: string;
  non_single_digit_price: number;
  single_digit_number_price: number;
};

const useDraw = () => {
  const queryClient = useQueryClient();

  const createDraw = useMutation({
    mutationFn: async (data: Draw) => {
      const res = await api.post("/draw/", data);
      return res?.data;
    },
    onSuccess: (newDraw) => {
      queryClient.setQueryData<Draw[]>(["/draw/list/"], (oldDraws = []) => [
        ...oldDraws,
        newDraw,
      ]);
    },
  });

  const updateDraw = useMutation({
    mutationFn: async (data: Draw) => {
      const res = await api.put(`/draw/${data.id}/`, data);
      return res?.data;
    },
    onSuccess: (updatedDraw) => {
      queryClient.setQueryData<Draw[]>(["/draw/list/"], (oldDraws = []) =>
        oldDraws.map((d) => (d.id === updatedDraw.id ? updatedDraw : d))
      );


    },
  });


  const createDrawResult = useMutation({
    mutationFn: async ({
      draw_session,
      ...rest
    }: {
      draw_session: number;
      first_prize: string;
      second_prize: string;
      third_prize: string;
      fourth_prize: string;
      fifth_prize: string;
      complementary_prizes: string[];
    }) => {
      const res = await api.post(`/draw-result/result/${draw_session}/`, rest);
      return res?.data;
    },
  });


  return { createDraw, updateDraw, createDrawResult };
};

export default useDraw;
